// ══════════════════════════════════════════════════════════════
//  ZR-Shop Admin Pro — GitHub API Edition
//  Token: kayb9a f localStorage dyalek GHIR, machi f code
// ══════════════════════════════════════════════════════════════

const GITHUB_REPO   = 'ZR-Business/ZR-Shop';
const GITHUB_FILE   = 'data.json';
const GITHUB_BRANCH = 'main';

class AdminZRShopPro {
    constructor() {
        this.products      = [];
        this.mediaPreviews = [];
        this.editingId     = null;
        this.githubToken   = localStorage.getItem('zrshop_gh_token') || '';
        this.init();
    }

    // ── INIT ────────────────────────────────────────────────────
    init() {
        this.checkAuth();
        this.renderTokenSection();
        this.loadProducts();
        this.setupEventListeners();
    }

    checkAuth() {
        if (!localStorage.getItem('zrshop_admin_pro')) {
            const pass = prompt('🔐 Mot de passe admin:');
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

    // ── TOKEN SECTION ────────────────────────────────────────────
    renderTokenSection() {
        const container = document.getElementById('tokenSection');
        if (!container) return;
        const hasToken = !!this.githubToken;
        container.innerHTML = `
            <div class="token-box ${hasToken ? 'token-ok' : 'token-missing'}">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <div style="font-size:1.5rem;">${hasToken ? '🔑' : '⚠️'}</div>
                    <div style="flex:1;">
                        <strong>${hasToken ? 'GitHub Token configuré ✅' : 'GitHub Token manquant ⚠️'}</strong><br>
                        <small style="color:#666;">
                            ${hasToken
                                ? 'Les produits sont synchronisés avec GitHub automatiquement.'
                                : 'Sans token, les produits ne seront pas visibles sur le site pour tous les visiteurs.'}
                        </small>
                    </div>
                    <button onclick="admin.toggleTokenInput()" class="admin-btn" style="background:#667eea;color:white;padding:8px 16px;border-radius:8px;font-size:0.85rem;">
                        ${hasToken ? '🔄 Changer token' : '➕ Ajouter token'}
                    </button>
                    ${hasToken ? `<button onclick="admin.removeToken()" class="admin-btn danger" style="padding:8px 16px;border-radius:8px;font-size:0.85rem;">🗑️</button>` : ''}
                </div>
                <div id="tokenInputArea" style="display:none;margin-top:15px;">
                    <div style="background:#fff8e1;border:2px solid #ffc107;border-radius:10px;padding:12px;margin-bottom:10px;font-size:0.85rem;">
                        🔒 <strong>Sécurité:</strong> Le token est stocké uniquement dans <em>votre navigateur</em> — jamais dans le code ni sur GitHub.
                    </div>
                    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                        <input type="password" id="tokenInput"
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            style="flex:1;padding:10px 14px;border:2px solid #ddd;border-radius:8px;font-size:0.9rem;min-width:200px;"
                            value="">
                        <button onclick="admin.saveToken()" class="admin-btn primary" style="padding:10px 20px;border-radius:8px;">
                            💾 Enregistrer
                        </button>
                    </div>
                    <small style="color:#aaa;margin-top:6px;display:block;">
                        GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → scope: ✅ repo
                    </small>
                </div>
            </div>`;
    }

    toggleTokenInput() {
        const area = document.getElementById('tokenInputArea');
        if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
    }

    saveToken() {
        const input = document.getElementById('tokenInput');
        const token = input?.value.trim();
        if (!token || !token.startsWith('ghp_')) {
            alert('❌ Token invalide — doit commencer par ghp_');
            return;
        }
        this.githubToken = token;
        localStorage.setItem('zrshop_gh_token', token);
        this.renderTokenSection();
        this.showNotification('🔑 Token enregistré ! Publie un produit pour tester.', 'success');
    }

    removeToken() {
        if (confirm('Supprimer le token GitHub ?')) {
            this.githubToken = '';
            localStorage.removeItem('zrshop_gh_token');
            this.renderTokenSection();
            this.showNotification('🗑️ Token supprimé', 'warning');
        }
    }

    // ── GITHUB API ───────────────────────────────────────────────
    async pushToGitHub(products) {
        if (!this.githubToken) {
            this.showNotification('⚠️ Ajoute ton GitHub Token d\'abord !', 'warning');
            return false;
        }

        // Vérifier taille — GitHub max ~50MB mais on limite à 5MB pour sécurité
        const jsonStr = JSON.stringify(products, null, 2);
        const sizeKB = Math.round(new Blob([jsonStr]).size / 1024);
        if (sizeKB > 5000) {
            this.showNotification(`❌ Données trop lourdes (${sizeKB}KB) — réduis le nombre de photos ou leur taille`, 'error');
            return false;
        }

        const content = btoa(unescape(encodeURIComponent(jsonStr)));

        try {
            // 1. Récupérer SHA actuel
            const getRes = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${GITHUB_BRANCH}`,
                { headers: { Authorization: `token ${this.githubToken}`, Accept: 'application/vnd.github.v3+json' } }
            );
            let sha = null;
            if (getRes.ok) {
                sha = (await getRes.json()).sha;
            } else if (getRes.status !== 404) {
                throw new Error(`GitHub GET: ${getRes.status}`);
            }

            // 2. Push fichier
            const putRes = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `token ${this.githubToken}`,
                        Accept: 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `🛍️ Update products — ${new Date().toLocaleString('fr-MA')}`,
                        content,
                        branch: GITHUB_BRANCH,
                        ...(sha ? { sha } : {})
                    })
                }
            );

            if (!putRes.ok) {
                const err = await putRes.json();
                throw new Error(err.message || putRes.status);
            }
            return true;
        } catch (err) {
            console.error('GitHub API Error:', err);
            this.showNotification(`❌ Erreur GitHub: ${err.message}`, 'error');
            return false;
        }
    }

    // ── PRODUCTS ─────────────────────────────────────────────────
    loadProducts() {
        const saved = localStorage.getItem('zrshop_products');
        this.products = saved ? JSON.parse(saved) : [];
        this.renderProductsList();
        document.getElementById('productsCount').textContent = this.products.length;
    }

    saveLocal() {
        localStorage.setItem('zrshop_products', JSON.stringify(this.products));
    }

    // ── FORM ─────────────────────────────────────────────────────
    setupEventListeners() {
        document.getElementById('productForm').onsubmit = (e) => this.addProduct(e);
        const fileInput  = document.getElementById('mediaFiles');
        const uploadZone = document.getElementById('uploadZone');
        fileInput.onchange    = () => this.handleFiles(fileInput.files);
        uploadZone.ondragover = (e) => e.preventDefault();
        uploadZone.ondrop     = (e) => { e.preventDefault(); this.handleFiles(e.dataTransfer.files); };
    }

    handleFiles(files) {
        Array.from(files).forEach(file => {
            if (this.mediaPreviews.length >= 10) { alert('Maximum 10 médias !'); return; }
            if (file.size > 50 * 1024 * 1024) { alert(`"${file.name}" dépasse 50MB.`); return; }

            if (file.type.includes('video')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.mediaPreviews.push({ url: e.target.result, name: file.name, type: 'video' });
                    this.renderPreviews();
                };
                reader.readAsDataURL(file);
            } else {
                // Kompressiw image qbel ma nkheznuha — khfif l GitHub
                const img = new Image();
                const objectUrl = URL.createObjectURL(file);
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxW = 800;
                    const ratio = Math.min(maxW / img.width, maxW / img.height, 1);
                    canvas.width  = Math.round(img.width  * ratio);
                    canvas.height = Math.round(img.height * ratio);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.72);
                    URL.revokeObjectURL(objectUrl);
                    this.mediaPreviews.push({ url: compressed, name: file.name, type: 'image' });
                    this.renderPreviews();
                };
                img.src = objectUrl;
            }
        });
    }

    renderPreviews() {
        document.getElementById('previewContainer').innerHTML =
            this.mediaPreviews.map((p, i) => `
                <div class="preview-item">
                    ${p.type === 'video'
                        ? `<video src="${p.url}" style="width:100%;height:100%;object-fit:cover;"></video>`
                        : `<img src="${p.url}" style="width:100%;height:100%;object-fit:cover;">`}
                    <button class="remove-btn" onclick="admin.removeMedia(${i})">×</button>
                </div>`).join('');
    }

    removeMedia(i) {
        this.mediaPreviews.splice(i, 1);
        this.renderPreviews();
    }

    async addProduct(e) {
        e.preventDefault();
        if (!document.getElementById('productName').value.trim()) { alert('❌ Nom requis !'); return; }
        if (this.mediaPreviews.length === 0) { alert('📸 Ajoute au moins 1 photo/vidéo !'); return; }

        const btn = document.querySelector('.admin-btn.primary');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publication en cours...';

        const mediaData = this.mediaPreviews.map(m => ({ type: m.type, url: m.url, name: m.name }));

        if (this.editingId) {
            const idx = this.products.findIndex(p => p.id === this.editingId);
            if (idx !== -1) {
                this.products[idx] = {
                    ...this.products[idx],
                    name:        document.getElementById('productName').value.trim(),
                    price:       parseFloat(document.getElementById('productPrice').value) || 0,
                    description: document.getElementById('productDesc').value || '',
                    category:    document.getElementById('productCategory').value,
                    stock:       parseInt(document.getElementById('productStock').value) || 10,
                    media:       mediaData
                };
            }
            this.editingId = null;
        } else {
            this.products.unshift({
                id:          Date.now(),
                name:        document.getElementById('productName').value.trim(),
                price:       parseFloat(document.getElementById('productPrice').value) || 0,
                description: document.getElementById('productDesc').value || '',
                category:    document.getElementById('productCategory').value,
                stock:       parseInt(document.getElementById('productStock').value) || 10,
                media:       mediaData,
                date:        new Date().toISOString()
            });
        }

        this.saveLocal();
        const pushed = await this.pushToGitHub(this.products);

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> Publier le produit';

        if (pushed) {
            this.showNotification('✅ Produit publié sur le site ! (GitHub mis à jour)', 'success');
        } else {
            this.showNotification('💾 Sauvegardé localement — ajoute ton token GitHub pour publier', 'warning');
        }

        document.getElementById('productForm').reset();
        this.mediaPreviews = [];
        document.getElementById('previewContainer').innerHTML = '';
        this.renderProductsList();
        document.getElementById('productsCount').textContent = this.products.length;
    }

    // ── LISTE ────────────────────────────────────────────────────
    renderProductsList() {
        document.getElementById('adminProductsList').innerHTML =
            this.products.map(p => `
                <div class="product-admin-item">
                    <div style="display:flex;align-items:center;gap:15px;">
                        ${p.media?.[0]
                            ? (p.media[0].type === 'video'
                                ? `<video src="${p.media[0].url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;" muted></video>`
                                : `<img src="${p.media[0].url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">`)
                            : `<div style="width:60px;height:60px;background:#eee;border-radius:8px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="color:#aaa;"></i></div>`}
                        <div>
                            <strong>${p.name}</strong><br>
                            <small>💰 ${p.price.toFixed(2)} MAD | 📦 ${p.stock} | 🖼️ ${p.media?.length || 0} médias</small><br>
                            <small style="color:#667eea;">${p.category}</small>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="admin.editProduct(${p.id})" style="background:#667eea;color:white;padding:8px 14px;border-radius:8px;border:none;cursor:pointer;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="admin.deleteProduct(${p.id})" style="background:#ff4757;color:white;padding:8px 14px;border-radius:8px;border:none;cursor:pointer;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`).join('')
            || '<p style="text-align:center;color:#aaa;padding:20px;">Aucun produit — commencez par en ajouter un !</p>';
    }

    async deleteProduct(id) {
        const p = this.products.find(p => p.id === id);
        if (!confirm(`🗑️ Supprimer "${p?.name}" définitivement ?`)) return;
        this.products = this.products.filter(p => p.id !== id);
        this.saveLocal();
        const pushed = await this.pushToGitHub(this.products);
        this.renderProductsList();
        document.getElementById('productsCount').textContent = this.products.length;
        this.showNotification(pushed ? '🗑️ Produit supprimé du site !' : '🗑️ Supprimé localement', pushed ? 'success' : 'warning');
    }

    editProduct(id) {
        const p = this.products.find(p => p.id === id);
        if (!p) return;
        this.editingId = id;
        document.getElementById('productName').value     = p.name;
        document.getElementById('productPrice').value    = p.price;
        document.getElementById('productDesc').value     = p.description;
        document.getElementById('productCategory').value = p.category;
        document.getElementById('productStock').value    = p.stock;
        this.mediaPreviews = p.media ? [...p.media] : [];
        this.renderPreviews();
        document.querySelector('.admin-btn.primary').innerHTML = '<i class="fas fa-save"></i> Enregistrer les modifications';
        document.getElementById('productName').scrollIntoView({ behavior: 'smooth' });
        this.showNotification(`✏️ Édition de "${p.name}"`, 'success');
    }

    // ── NOTIFICATIONS ────────────────────────────────────────────
    showNotification(msg, type = 'success') {
        const bg = { success: 'linear-gradient(45deg,#2ed573,#1abc9c)', warning: 'linear-gradient(45deg,#ffa502,#ff6348)', error: 'linear-gradient(45deg,#ff4757,#c0392b)' };
        const n = document.createElement('div');
        n.style.cssText = `position:fixed;top:100px;right:20px;background:${bg[type]||bg.success};color:white;
            padding:15px 22px;border-radius:12px;z-index:10000;font-weight:bold;max-width:360px;
            box-shadow:0 10px 30px rgba(0,0,0,0.25);transform:translateX(420px);
            transition:transform 0.3s;font-size:0.88rem;line-height:1.5;`;
        n.textContent = msg;
        document.body.appendChild(n);
        setTimeout(() => n.style.transform = 'translateX(0)', 100);
        setTimeout(() => { n.style.transform = 'translateX(420px)'; setTimeout(() => n.remove(), 300); }, 4500);
    }
}

const admin = new AdminZRShopPro();