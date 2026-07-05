// ══════════════════════════════════════════════════════════════
//  ZR-SHOP ADMIN — GitHub Issues كـ base de données
// ══════════════════════════════════════════════════════════════

class AdminZRShopPro {
    constructor() {
        this.products = [];
        this.mediaPreviews = [];
        this.editingId = null;
        this.GITHUB_USER  = localStorage.getItem('gh_user')  || '';
        this.GITHUB_REPO  = localStorage.getItem('gh_repo')  || '';
        this.GITHUB_TOKEN = localStorage.getItem('gh_token') || '';
        this.init();
    }

    init() {
        this.checkAuth();
        if (!this.GITHUB_USER || !this.GITHUB_REPO || !this.GITHUB_TOKEN) {
            this.showGithubSetup();
        } else {
            this.loadProducts();
        }
        this.setupEventListeners();
    }

    showGithubSetup() {
        document.getElementById('githubSetupModal').style.display = 'flex';
    }

    saveGithubConfig() {
        const user  = document.getElementById('ghUser').value.trim();
        const repo  = document.getElementById('ghRepo').value.trim();
        const token = document.getElementById('ghToken').value.trim();
        if (!user || !repo || !token) { alert('⚠️ املا جميع الحقول!'); return; }
        localStorage.setItem('gh_user', user);
        localStorage.setItem('gh_repo', repo);
        localStorage.setItem('gh_token', token);
        this.GITHUB_USER = user; this.GITHUB_REPO = repo; this.GITHUB_TOKEN = token;
        document.getElementById('githubSetupModal').style.display = 'none';
        this.showNotification('✅ GitHub متصل!');
        this.loadProducts();
    }

    checkAuth() {
        if (!localStorage.getItem('zrshop_admin_pro')) {
            const pass = prompt('🔐 Mot de passe:');
            if (pass === 'zrshop2026') {
                localStorage.setItem('zrshop_admin_pro', 'true');
            } else {
                alert('❌ Accès refusé');
                window.location.href = 'index.html';
                return;
            }
        }
        document.body.style.display = 'block';
    }

    logout() {
        localStorage.removeItem('zrshop_admin_pro');
        window.location.href = 'index.html';
    }

    get apiBase() { return `https://api.github.com/repos/${this.GITHUB_USER}/${this.GITHUB_REPO}`; }
    get headers() {
        return {
            'Authorization': `token ${this.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    }

    issueToProduct(issue) {
        try {
            const match = issue.body.match(/```json\n([\s\S]*?)\n```/);
            if (!match) return null;
            const data = JSON.parse(match[1]);
            return { ...data, id: issue.number, _issueNumber: issue.number };
        } catch { return null; }
    }

    async loadProducts() {
        this.showLoading(true);
        try {
            const res = await fetch(`${this.apiBase}/issues?labels=produit&state=open&per_page=100`, { headers: this.headers });
            if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
            const issues = await res.json();
            this.products = issues.map(i => this.issueToProduct(i)).filter(Boolean)
                .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            this.renderProductsList();
            document.getElementById('productsCount').textContent = this.products.length;
        } catch (err) {
            console.error(err);
            this.showNotification('❌ خطأ في تحميل المنتجات — تحقق من الإعدادات');
        }
        this.showLoading(false);
    }

    async ensureLabel() {
        try {
            await fetch(`${this.apiBase}/labels`, {
                method: 'POST', headers: this.headers,
                body: JSON.stringify({ name: 'produit', color: 'ff6b35' })
            });
        } catch {}
    }

    async saveNewProduct(productData) {
        await this.ensureLabel();
        const body = `<!-- ZR-Shop Product -->\n\`\`\`json\n${JSON.stringify(productData, null, 2)}\n\`\`\``;
        const res = await fetch(`${this.apiBase}/issues`, {
            method: 'POST', headers: this.headers,
            body: JSON.stringify({ title: `[PRODUIT] ${productData.name}`, body, labels: ['produit'] })
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
        return await res.json();
    }

    async updateProduct(issueNumber, productData) {
        const body = `<!-- ZR-Shop Product -->\n\`\`\`json\n${JSON.stringify(productData, null, 2)}\n\`\`\``;
        const res = await fetch(`${this.apiBase}/issues/${issueNumber}`, {
            method: 'PATCH', headers: this.headers,
            body: JSON.stringify({ title: `[PRODUIT] ${productData.name}`, body })
        });
        if (!res.ok) throw new Error('Erreur update');
    }

    async deleteProductFromGitHub(issueNumber) {
        const res = await fetch(`${this.apiBase}/issues/${issueNumber}`, {
            method: 'PATCH', headers: this.headers,
            body: JSON.stringify({ state: 'closed' })
        });
        if (!res.ok) throw new Error('Erreur suppression');
    }

    setupEventListeners() {
        document.getElementById('productForm').onsubmit = (e) => this.addProduct(e);
        const fileInput = document.getElementById('mediaFiles');
        const uploadZone = document.getElementById('uploadZone');
        fileInput.onchange = () => this.handleFiles(fileInput.files);
        uploadZone.ondragover = (e) => e.preventDefault();
        uploadZone.ondrop = (e) => { e.preventDefault(); this.handleFiles(e.dataTransfer.files); };
    }

    handleFiles(files) {
        Array.from(files).forEach(async (file) => {
            if (this.mediaPreviews.length >= 10) { alert('Maximum 10 médias!'); return; }
            if (!file.type.includes('image')) {
                alert(`"${file.name}" mashi ṣura — les vidéos khass tzidhom b lien (chouf l-champ "Vidéo (lien externe)" taht).`);
                return;
            }
            try {
                const compressedUrl = await this.compressImage(file);
                this.mediaPreviews.push({ url: compressedUrl, name: file.name, type: 'image' });
                this.renderPreviews();
            } catch (err) {
                console.error(err);
                alert(`❌ Mقدرتش نضغط "${file.name}". Jarreb ṣura khra.`);
            }
        });
    }

    // Compresse et redimensionne une image côté navigateur pour rester
    // largement sous la limite de 65 536 caractères d'un body d'issue GitHub.
    compressImage(file, maxWidth = 900, quality = 0.6) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('read failed'));
            reader.onload = (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error('image load failed'));
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    addVideoUrl() {
        const input = document.getElementById('videoUrlInput');
        const url = input.value.trim();
        if (!url) { alert('⚠️ Dkhel lien dyal la vidéo!'); return; }
        if (this.mediaPreviews.length >= 10) { alert('Maximum 10 médias!'); return; }
        this.mediaPreviews.push({ url, name: 'video-link', type: 'video' });
        input.value = '';
        this.renderPreviews();
    }

    renderPreviews() {
        document.getElementById('previewContainer').innerHTML =
            this.mediaPreviews.map((p, i) => `
                <div class="preview-item">
                    ${p.type === 'video' ? `<video src="${p.url}" style="width:100%;height:100%;object-fit:cover;"></video>` : `<img src="${p.url}" style="width:100%;height:100%;object-fit:cover;">`}
                    <button class="remove-btn" onclick="admin.removeMedia(${i})">×</button>
                </div>`).join('');
    }

    removeMedia(index) { this.mediaPreviews.splice(index, 1); this.renderPreviews(); }

    async addProduct(e) {
        e.preventDefault();
        const name = document.getElementById('productName').value.trim();
        if (!name) { alert('❌ Nom requis!'); return; }
        if (this.mediaPreviews.length === 0) { alert('📸 Ajoute au moins 1 photo!'); return; }
        this.showLoading(true);
        try {
            const productData = {
                name,
                price: parseFloat(document.getElementById('productPrice').value) || 0,
                description: document.getElementById('productDesc').value || '',
                category: document.getElementById('productCategory').value,
                stock: parseInt(document.getElementById('productStock').value) || 10,
                media: this.mediaPreviews.map(m => ({ type: m.type, url: m.url, name: m.name })),
                date: new Date().toISOString()
            };

            // GitHub limite le body d'un issue à 65 536 caractères — on vérifie
            // avant l'envoi pour éviter un échec silencieux ou une longue attente inutile.
            const payloadSize = JSON.stringify(productData).length;
            if (payloadSize > 60000) {
                this.showLoading(false);
                alert(`⚠️ Les médias kbar bzzaf (${Math.round(payloadSize/1024)}KB). Hيد chi ṣura wla استعمل ṣur أصغر — GitHub kayqbel ghir 65KB f kol produit.`);
                return;
            }

            if (this.editingId) {
                const product = this.products.find(p => p.id === this.editingId);
                await this.updateProduct(product._issueNumber, productData);
                this.showNotification(`✅ "${name}" محدث!`);
                this.editingId = null;
                document.querySelector('.admin-btn.primary').innerHTML = '<i class="fas fa-rocket"></i> Publier le produit';
            } else {
                await this.saveNewProduct(productData);
                this.showNotification(`✅ "${name}" publié sur le site!`);
            }
            document.getElementById('productForm').reset();
            this.mediaPreviews = [];
            document.getElementById('previewContainer').innerHTML = '';
            await this.loadProducts();
        } catch (err) {
            console.error(err);
            let msg = err.message || 'Erreur inconnue';
            if (/too long/i.test(msg)) {
                msg = 'Les médias kbar bzzaf f had l-produit — نقص شي ṣura.';
            } else if (/401|Bad credentials/i.test(msg)) {
                msg = 'Token GitHub ghalat wla khass tجدد — dkhel l-Settings o zid token jdid.';
            } else if (/403/i.test(msg)) {
                msg = 'Rate limit wla accès mrfoud mn GitHub — sna chi dqiqa o 3awd جرب.';
            } else if (/Failed to fetch/i.test(msg)) {
                msg = 'Mشي connecté l internet, wla GitHub ma jawebch — تأكد من الاتصال.';
            }
            this.showNotification('❌ ' + msg);
        }
        this.showLoading(false);
    }

    renderProductsList() {
        document.getElementById('adminProductsList').innerHTML =
            this.products.map(product => `
                <div class="product-admin-item">
                    <div style="display:flex;align-items:center;gap:15px;">
                        ${product.media?.[0] ? (product.media[0].type === 'video'
                            ? `<video src="${product.media[0].url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;" muted></video>`
                            : `<img src="${product.media[0].url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">`)
                            : `<div style="width:60px;height:60px;background:#eee;border-radius:8px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="color:#aaa;"></i></div>`}
                        <div>
                            <strong>${product.name}</strong><br>
                            <small>💰 ${product.price.toFixed(2)} MAD | 📦 ${product.stock} | 🖼️ ${product.media?.length || 0} médias</small><br>
                            <small style="color:#667eea;">${product.category}</small>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="admin-btn" onclick="admin.editProduct(${product.id})" style="background:#667eea;color:white;padding:8px 14px;border-radius:8px;font-size:0.85rem;"><i class="fas fa-edit"></i></button>
                        <button class="admin-btn danger" onclick="admin.deleteProduct(${product.id})" style="padding:8px 14px;border-radius:8px;font-size:0.85rem;"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`).join('') || '<p style="text-align:center;color:#aaa;padding:20px;">Aucun produit — commencez par en ajouter un !</p>';
    }

    async deleteProduct(id) {
        const product = this.products.find(p => p.id === id);
        if (!product || !confirm(`🗑️ Supprimer "${product.name}" ?`)) return;
        this.showLoading(true);
        try {
            await this.deleteProductFromGitHub(product._issueNumber);
            this.showNotification('🗑️ Produit supprimé');
            await this.loadProducts();
        } catch { this.showNotification('❌ Erreur suppression'); }
        this.showLoading(false);
    }

    editProduct(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) return;
        this.editingId = id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productDesc').value = product.description;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productStock').value = product.stock;
        this.mediaPreviews = product.media ? [...product.media] : [];
        this.renderPreviews();
        document.querySelector('.admin-btn.primary').innerHTML = '<i class="fas fa-save"></i> Enregistrer les modifications';
        document.getElementById('productName').scrollIntoView({ behavior: 'smooth' });
        this.showNotification(`✏️ Édition de "${product.name}"`);
    }

    showLoading(show) {
        let loader = document.getElementById('adminLoader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'adminLoader';
            loader.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;"><div style="background:white;border-radius:16px;padding:30px 40px;text-align:center;font-size:1.1rem;font-weight:600;box-shadow:0 20px 60px rgba(0,0,0,0.3);"><div style="font-size:2rem;margin-bottom:10px;">⏳</div>جاري الحفظ...</div></div>`;
            document.body.appendChild(loader);
        }
        loader.style.display = show ? 'block' : 'none';
    }

    showNotification(msg) {
        const notif = document.createElement('div');
        notif.style.cssText = `position:fixed;top:100px;right:20px;background:#2ed573;color:white;padding:15px 25px;border-radius:10px;z-index:10000;font-weight:bold;box-shadow:0 10px 30px rgba(0,0,0,0.3);transform:translateX(400px);transition:transform 0.3s;`;
        notif.textContent = msg;
        document.body.appendChild(notif);
        setTimeout(() => notif.style.transform = 'translateX(0)', 100);
        setTimeout(() => { notif.style.transform = 'translateX(400px)'; setTimeout(() => notif.remove(), 300); }, 3000);
    }
}

const admin = new AdminZRShopPro();
