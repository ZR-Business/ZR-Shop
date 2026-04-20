class ZRShop {
    constructor() {
        this.products         = [];
        this.visibleProducts  = 6;
        this.sliderState      = {};
        this.modalSliderState = { current: 0, total: 0 };
        this.currentModalId   = null;
        this.currentStars     = 5;
        this.init();
    }

    async init() {
        await this.loadProducts();
        this.renderProducts();
        this.updateStats();
        this.setupEventListeners();
        this.animateOnScroll();
        this.createModal();
    }

    async loadProducts() {
        try {
            let jsonProducts = [];
            try {
                const res = await fetch('data.json');
                jsonProducts = await res.json();
            } catch (e) {}
            // Si data.json a des produits → utilise-les (source GitHub = vérité)
            // Sinon fallback localStorage
            if (jsonProducts.length > 0) {
                this.products = jsonProducts;
            } else {
                const local = JSON.parse(localStorage.getItem('zrshop_products') || '[]');
                this.products = local;
            }
            this.products.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        } catch (e) {
            this.products = [];
        }
    }

    renderProducts() {
        const grid = document.getElementById('productsGrid');
        const list = this.products.slice(0, this.visibleProducts);

        grid.innerHTML = list.map((product, index) => {
            const mediaList = product.media ? [...product.media] : [];
            if (mediaList.length === 0 && product.image) mediaList.push({ type: 'image', url: product.image });
            const hasMultiple = mediaList.length > 1;

            return `
            <div class="product-card" data-index="${index}" data-category="${product.category || 'Tech'}" onclick="zrshop.openModal(${product.id})">
                <div class="product-image" data-stock="${product.stock > 0 ? 'En stock' : 'Rupture'}">
                    <div class="media-slider" id="slider-${product.id}">
                        ${mediaList.length > 0 ? mediaList.map((m, i) => `
                            <div class="slide ${i === 0 ? 'active' : ''}">
                                ${m.type === 'video'
                                    ? `<video src="${m.url}" muted autoplay loop playsinline style="width:100%;height:100%;object-fit:cover;"></video>`
                                    : `<img src="${m.url}" alt="${product.name}" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';" style="width:100%;height:100%;object-fit:cover;">`}
                            </div>`).join('') : `
                            <div class="slide active">
                                <div style="height:280px;background:linear-gradient(45deg,#1a1a1a,#333);display:flex;align-items:center;justify-content:center;">
                                    <i class="fas fa-image" style="font-size:4rem;color:#555;"></i>
                                </div>
                            </div>`}
                    </div>
                    ${hasMultiple ? `
                        <button class="slider-btn prev" onclick="event.stopPropagation();zrshop.slideMedia('${product.id}',-1)"><i class="fas fa-chevron-left"></i></button>
                        <button class="slider-btn next" onclick="event.stopPropagation();zrshop.slideMedia('${product.id}',1)"><i class="fas fa-chevron-right"></i></button>
                        <div class="slider-dots">${mediaList.map((_,i)=>`<span class="dot ${i===0?'active':''}" onclick="event.stopPropagation();zrshop.goToSlide('${product.id}',${i})"></span>`).join('')}</div>
                        <div class="media-count"><i class="fas fa-images"></i> ${mediaList.length}</div>` : ''}
                    ${product.category ? `<div class="category-badge">${product.category}</div>` : ''}
                </div>
                <div class="product-info">
                    <h3 title="${product.name}">${product.name || 'Produit Premium'}</h3>
                    <div class="product-price">${product.price ? product.price.toFixed(2) + ' MAD' : '89.99 MAD'}</div>
                    <p class="product-desc">${(product.description || 'Qualité premium garantie').substring(0, 80)}${(product.description?.length > 80) ? '...' : ''}</p>
                    <div class="product-actions">
                        <button class="product-order primary" onclick="event.stopPropagation();zrshop.quickOrder(${product.id})">
                            <i class="fab fa-whatsapp"></i> Commander
                        </button>
                        ${product.stock === 0 ? '<span class="stock-out">🔴 Rupture</span>' : '<span class="stock-info">🟢 Disponible</span>'}
                    </div>
                </div>
            </div>`;
        }).join('');

        this.sliderState = {};
        list.forEach(p => {
            this.sliderState[p.id] = { current: 0, total: p.media?.length || (p.image ? 1 : 0) };
        });

        document.getElementById('loadMoreBtn').style.display =
            this.products.length > this.visibleProducts ? 'flex' : 'none';
    }

    // ── CARD SLIDER ──────────────────────────────────────────────
    slideMedia(productId, dir) {
        const slider = document.getElementById(`slider-${productId}`);
        if (!slider) return;
        const slides = slider.querySelectorAll('.slide');
        const dots   = slider.parentElement.querySelectorAll('.dot');
        if (!slides.length) return;
        if (!this.sliderState[productId]) this.sliderState[productId] = { current: 0, total: slides.length };
        let cur = this.sliderState[productId].current;
        slides[cur].classList.remove('active');
        if (dots[cur]) dots[cur].classList.remove('active');
        cur = (cur + dir + slides.length) % slides.length;
        this.sliderState[productId].current = cur;
        slides[cur].classList.add('active');
        if (dots[cur]) dots[cur].classList.add('active');
    }

    goToSlide(productId, index) {
        const slider = document.getElementById(`slider-${productId}`);
        if (!slider) return;
        const slides = slider.querySelectorAll('.slide');
        const dots   = slider.parentElement.querySelectorAll('.dot');
        if (!this.sliderState[productId]) this.sliderState[productId] = { current: 0, total: slides.length };
        const cur = this.sliderState[productId].current;
        slides[cur].classList.remove('active');
        if (dots[cur]) dots[cur].classList.remove('active');
        this.sliderState[productId].current = index;
        slides[index].classList.add('active');
        if (dots[index]) dots[index].classList.add('active');
    }

    // ── MODAL ────────────────────────────────────────────────────
    createModal() {
        const modal = document.createElement('div');
        modal.id = 'productModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="zrshop.closeModal()"></div>
            <div class="modal-box">
                <button class="modal-close" onclick="zrshop.closeModal()"><i class="fas fa-times"></i></button>
                <div class="modal-inner">
                    <div class="modal-media">
                        <div class="modal-slider" id="modalSlider"></div>
                        <button class="slider-btn prev" id="modalPrev" onclick="zrshop.modalSlide(-1)" style="display:none;"><i class="fas fa-chevron-left"></i></button>
                        <button class="slider-btn next" id="modalNext" onclick="zrshop.modalSlide(1)"  style="display:none;"><i class="fas fa-chevron-right"></i></button>
                        <div class="slider-dots" id="modalDots"></div>
                    </div>
                    <div class="modal-details">
                        <span class="modal-category" id="modalCategory"></span>
                        <h2 id="modalName"></h2>
                        <div class="modal-price" id="modalPrice"></div>
                        <div class="modal-stock" id="modalStock"></div>
                        <p class="modal-desc" id="modalDesc"></p>
                        <button class="product-order primary modal-order" onclick="zrshop.quickOrder(zrshop.currentModalId)">
                            <i class="fab fa-whatsapp"></i> Commander sur WhatsApp
                        </button>
                        <div class="modal-comments">
                            <h4><i class="fas fa-comments"></i> Avis clients (<span id="commentsCount">0</span>)</h4>
                            <div class="comments-list" id="commentsList"></div>
                            <div class="comment-form">
                                <input type="text" id="commentName" placeholder="Votre prénom..." maxlength="30">
                                <div class="star-rating" id="starRating">
                                    <span onclick="zrshop.setStars(1)">★</span>
                                    <span onclick="zrshop.setStars(2)">★</span>
                                    <span onclick="zrshop.setStars(3)">★</span>
                                    <span onclick="zrshop.setStars(4)">★</span>
                                    <span onclick="zrshop.setStars(5)">★</span>
                                </div>
                                <textarea id="commentText" placeholder="Votre avis sur ce produit..." rows="3" maxlength="300"></textarea>
                                <button onclick="zrshop.submitComment()" class="comment-submit">
                                    <i class="fas fa-paper-plane"></i> Publier mon avis
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeModal(); });
    }

    openModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        this.currentModalId = productId;

        const mediaList = product.media ? [...product.media] : [];
        if (mediaList.length === 0 && product.image) mediaList.push({ type: 'image', url: product.image });

        this.modalSliderState = { current: 0, total: mediaList.length };

        document.getElementById('modalSlider').innerHTML = mediaList.map((m, i) => `
            <div class="modal-slide" style="position:absolute;inset:0;opacity:${i===0?1:0};transition:opacity 0.4s;pointer-events:${i===0?'auto':'none'};">
                ${m.type === 'video'
                    ? `<video src="${m.url}" controls style="width:100%;height:100%;object-fit:contain;background:#000;"></video>`
                    : `<img src="${m.url}" alt="${product.name}" style="width:100%;height:100%;object-fit:contain;background:#111;">`}
            </div>`).join('')
            || `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:#1a1a1a;"><i class="fas fa-image" style="font-size:5rem;color:#444;"></i></div>`;

        document.getElementById('modalDots').innerHTML = mediaList.length > 1
            ? mediaList.map((_, i) => `<span class="dot ${i===0?'active':''}" onclick="zrshop.modalGoTo(${i})"></span>`).join('') : '';
        document.getElementById('modalPrev').style.display = mediaList.length > 1 ? 'flex' : 'none';
        document.getElementById('modalNext').style.display = mediaList.length > 1 ? 'flex' : 'none';

        document.getElementById('modalCategory').textContent = product.category || '';
        document.getElementById('modalName').textContent     = product.name;
        document.getElementById('modalPrice').textContent    = (product.price?.toFixed(2) || '0.00') + ' MAD';
        document.getElementById('modalStock').innerHTML      = product.stock === 0
            ? '<span style="color:#ff4757;">🔴 Rupture de stock</span>'
            : `<span style="color:#2ed573;">🟢 En stock (${product.stock} disponibles)</span>`;
        document.getElementById('modalDesc').textContent = product.description || 'Qualité premium garantie.';

        this.renderComments(productId);
        this.currentStars = 5;
        this.updateStarUI(5);
        document.getElementById('productModal').classList.add('open');
        document.body.classList.add('no-scroll');
    }

    closeModal() {
        document.getElementById('productModal').classList.remove('open');
        document.body.classList.remove('no-scroll');
        this.currentModalId = null;
    }

    modalSlide(dir) {
        const slides = document.querySelectorAll('.modal-slide');
        const dots   = document.querySelectorAll('#modalDots .dot');
        if (!slides.length) return;
        let cur = this.modalSliderState.current;
        slides[cur].style.opacity = '0'; slides[cur].style.pointerEvents = 'none';
        if (dots[cur]) dots[cur].classList.remove('active');
        cur = (cur + dir + slides.length) % slides.length;
        this.modalSliderState.current = cur;
        slides[cur].style.opacity = '1'; slides[cur].style.pointerEvents = 'auto';
        if (dots[cur]) dots[cur].classList.add('active');
    }

    modalGoTo(index) {
        const slides = document.querySelectorAll('.modal-slide');
        const dots   = document.querySelectorAll('#modalDots .dot');
        const cur    = this.modalSliderState.current;
        slides[cur].style.opacity = '0'; slides[cur].style.pointerEvents = 'none';
        if (dots[cur]) dots[cur].classList.remove('active');
        this.modalSliderState.current = index;
        slides[index].style.opacity = '1'; slides[index].style.pointerEvents = 'auto';
        if (dots[index]) dots[index].classList.add('active');
    }

    // ── COMMENTAIRES ─────────────────────────────────────────────
    getComments(productId) {
        return JSON.parse(localStorage.getItem(`zrshop_comments_${productId}`) || '[]');
    }
    saveComments(productId, comments) {
        localStorage.setItem(`zrshop_comments_${productId}`, JSON.stringify(comments));
    }
    renderComments(productId) {
        const comments = this.getComments(productId);
        document.getElementById('commentsCount').textContent = comments.length;
        document.getElementById('commentsList').innerHTML = comments.length > 0
            ? comments.map(c => `
                <div class="comment-item">
                    <div class="comment-header">
                        <strong>${c.name}</strong>
                        <span class="comment-stars">${'★'.repeat(c.stars)}${'☆'.repeat(5-c.stars)}</span>
                        <span class="comment-date">${c.date}</span>
                    </div>
                    <p>${c.text}</p>
                </div>`).join('')
            : '<p class="no-comments">Soyez le premier à laisser un avis ! 💬</p>';
    }
    setStars(n) { this.currentStars = n; this.updateStarUI(n); }
    updateStarUI(n) {
        document.querySelectorAll('#starRating span').forEach((s, i) => { s.style.color = i < n ? '#f7931e' : '#ccc'; });
    }
    submitComment() {
        const name = document.getElementById('commentName').value.trim();
        const text = document.getElementById('commentText').value.trim();
        if (!name || !text) { this.showNotification('⚠️ Prénom et avis sont requis !'); return; }
        const comments = this.getComments(this.currentModalId);
        comments.unshift({ name, text, stars: this.currentStars, date: new Date().toLocaleDateString('fr-MA') });
        this.saveComments(this.currentModalId, comments);
        this.renderComments(this.currentModalId);
        document.getElementById('commentName').value = '';
        document.getElementById('commentText').value = '';
        this.currentStars = 5; this.updateStarUI(5);
        this.showNotification('✅ Avis publié, choukran ! 🙏');
    }

    // ── COMMANDE WHATSAPP ─────────────────────────────────────────
    quickOrder(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        const msg = `Salam ZR-Shop ! 👋%0A%0A📦 Produit: ${encodeURIComponent(product.name)}%0A💰 Prix: ${product.price?.toFixed(2)} MAD%0A📝 Quantité: 1%0A%0ABghit ncommandi, choukran ! 🙏`;
        window.open(`https://wa.me/212728805714?text=${msg}`, '_blank');
        this.showNotification('💬 Redirection vers WhatsApp...');
    }

    // ── STATS & EVENTS ────────────────────────────────────────────
    updateStats() {
        document.getElementById('productsCountHero').textContent = this.products.length;
    }

    setupEventListeners() {
        const hamburger = document.querySelector('.hamburger');
        const navMenu   = document.querySelector('.nav-menu');
        hamburger?.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.classList.toggle('no-scroll');
        });
        document.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
            });
        });
        document.querySelectorAll('.category-card')?.forEach(card => {
            card.addEventListener('click', (e) => this.filterByCategory(e.currentTarget.dataset.category));
        });
        window.zrshop = this;
    }

    filterByCategory(category) {
        document.querySelectorAll('.product-card').forEach(card => {
            const match = category === 'Toutes' || card.dataset.category === category;
            card.style.opacity   = match ? '1' : '0.3';
            card.style.transform = match ? 'translateY(0) scale(1)' : 'scale(0.95)';
        });
    }

    animateOnScroll() {
        const observer = new IntersectionObserver(
            (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('animate'); }),
            { threshold: 0.1 }
        );
        document.querySelectorAll('.product-card, .category-card, .step').forEach(el => observer.observe(el));
    }

    showNotification(message) {
        const n = document.createElement('div');
        n.className = 'notification';
        n.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        document.body.appendChild(n);
        setTimeout(() => n.classList.add('show'), 100);
        setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3500);
    }
}

// ── CSS ──────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
    body.no-scroll { overflow: hidden; }

    .media-slider { position:relative; width:100%; height:100%; }
    .slide { position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; transition:opacity 0.4s; pointer-events:none; }
    .slide.active { opacity:1; pointer-events:auto; }
    .slider-btn { position:absolute; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.55); color:white; border:none; width:34px; height:34px; border-radius:50%; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; font-size:0.8rem; transition:background 0.2s; backdrop-filter:blur(4px); }
    .slider-btn:hover { background:rgba(0,0,0,0.85); }
    .slider-btn.prev { left:10px; }
    .slider-btn.next { right:10px; }
    .slider-dots { position:absolute; bottom:10px; left:50%; transform:translateX(-50%); display:flex; gap:5px; z-index:10; }
    .dot { width:7px; height:7px; border-radius:50%; background:rgba(255,255,255,0.5); cursor:pointer; transition:all 0.2s; }
    .dot.active { background:white; transform:scale(1.3); }
    .media-count { position:absolute; bottom:10px; right:12px; background:rgba(0,0,0,0.55); color:white; padding:3px 10px; border-radius:15px; font-size:0.75rem; z-index:10; }

    #productModal { display:none; position:fixed; inset:0; z-index:9000; align-items:center; justify-content:center; padding:15px; }
    #productModal.open { display:flex; }
    .modal-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.78); backdrop-filter:blur(5px); }
    .modal-box { position:relative; background:white; border-radius:22px; width:100%; max-width:920px; max-height:92vh; overflow-y:auto; z-index:1; animation:modalIn 0.32s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes modalIn { from { opacity:0; transform:scale(0.88) translateY(30px); } to { opacity:1; transform:scale(1) translateY(0); } }
    .modal-close { position:absolute; top:14px; right:14px; background:#f0f0f0; border:none; width:38px; height:38px; border-radius:50%; font-size:1rem; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; transition:all 0.2s; }
    .modal-close:hover { background:#ff4757; color:white; }
    .modal-inner { display:grid; grid-template-columns:1fr 1fr; min-height:420px; }
    @media(max-width:650px) { .modal-inner { grid-template-columns:1fr; } }
    .modal-media { position:relative; background:#111; border-radius:22px 0 0 22px; overflow:hidden; min-height:380px; }
    @media(max-width:650px) { .modal-media { border-radius:22px 22px 0 0; min-height:260px; } }
    .modal-slider { position:relative; width:100%; height:100%; min-height:380px; }
    @media(max-width:650px) { .modal-slider { min-height:260px; } }
    .modal-details { padding:28px 22px; display:flex; flex-direction:column; gap:11px; overflow-y:auto; }
    .modal-category { background:linear-gradient(45deg,#667eea,#764ba2); color:white; padding:4px 14px; border-radius:20px; font-size:0.8rem; font-weight:600; width:fit-content; }
    .modal-details h2 { font-size:1.45rem; color:#1a1a1a; line-height:1.3; margin:0; }
    .modal-price { font-size:1.75rem; font-weight:700; color:#ff6b35; }
    .modal-desc { color:#555; line-height:1.7; font-size:0.93rem; }
    .modal-order { width:100%; padding:13px; font-size:1rem; }

    .modal-comments { border-top:2px solid #f0f0f0; padding-top:15px; margin-top:4px; }
    .modal-comments h4 { font-size:0.95rem; color:#333; margin-bottom:10px; display:flex; align-items:center; gap:7px; }
    .comments-list { display:flex; flex-direction:column; gap:9px; margin-bottom:13px; max-height:170px; overflow-y:auto; }
    .comment-item { background:#f8f9fa; border-radius:10px; padding:11px 13px; }
    .comment-header { display:flex; align-items:center; gap:9px; margin-bottom:5px; flex-wrap:wrap; }
    .comment-header strong { font-size:0.88rem; color:#1a1a1a; }
    .comment-stars { color:#f7931e; font-size:0.88rem; letter-spacing:1px; }
    .comment-date { color:#bbb; font-size:0.76rem; margin-left:auto; }
    .comment-item p { color:#555; font-size:0.87rem; line-height:1.5; margin:0; }
    .no-comments { color:#bbb; font-size:0.88rem; text-align:center; padding:8px 0; }
    .comment-form { display:flex; flex-direction:column; gap:8px; }
    .comment-form input, .comment-form textarea { border:2px solid #eee; border-radius:10px; padding:9px 13px; font-size:0.88rem; font-family:inherit; resize:none; transition:border-color 0.2s; }
    .comment-form input:focus, .comment-form textarea:focus { outline:none; border-color:#667eea; }
    .star-rating { display:flex; gap:3px; font-size:1.45rem; cursor:pointer; }
    .star-rating span { color:#ccc; transition:color 0.1s; user-select:none; }
    .comment-submit { background:linear-gradient(45deg,#667eea,#764ba2); color:white; border:none; padding:10px 18px; border-radius:25px; font-weight:600; cursor:pointer; font-size:0.9rem; display:flex; align-items:center; gap:7px; justify-content:center; transition:opacity 0.2s; }
    .comment-submit:hover { opacity:0.85; }

    .notification { position:fixed; top:20px; right:-420px; background:linear-gradient(45deg,#2ed573,#1abc9c); color:white; padding:18px 28px; border-radius:14px; box-shadow:0 15px 35px rgba(46,213,115,0.4); z-index:10000; font-weight:500; display:flex; align-items:center; gap:11px; transition:right 0.4s cubic-bezier(0.25,0.46,0.45,0.94); max-width:380px; font-size:0.95rem; }
    .notification.show { right:18px; }
    .product-card, .category-card, .step { opacity:0; transform:translateY(60px); transition:all 0.8s cubic-bezier(0.25,0.46,0.45,0.94); }
    .animate { opacity:1 !important; transform:translateY(0) !important; }
    .category-badge { position:absolute; top:15px; left:15px; background:rgba(102,126,234,0.95); color:white; padding:6px 14px; border-radius:20px; font-size:0.8rem; font-weight:600; z-index:5; }
    .stock-out { color:#ff4757 !important; font-weight:700; }
    .stock-info { color:#2ed573 !important; font-size:0.9rem; font-weight:500; }
    .product-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .product-card { cursor:pointer; }
    .product-order { background:linear-gradient(45deg,#25D366,#128C7E); color:white; padding:12px 25px; border:none; border-radius:25px; font-weight:bold; cursor:pointer; transition:all 0.3s; display:flex; align-items:center; gap:8px; font-size:0.95rem; }
    .product-order:hover { transform:scale(1.05); opacity:0.9; }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => { window.zrshop = new ZRShop(); });