// Aplicație principală actualizată pentru Moldova
class SmartShopApp {
    constructor() {
        this.nlpEngine = new NLPEngine();
        this.recommendationEngine = new RecommendationEngine(this.nlpEngine);
        this.scraper = new ProductScraper();
        this.products = [];
        this.currentResults = [];
        this.scoredResults = [];
        this.currency = 'MDL'; // Lei moldovenești
        this.searchHistory = this.loadSearchHistory();
        this.wishlist = this.loadWishlist();
        this.initializeElements();
        this.attachEventListeners();
        this.showWelcomeMessage();
        this.renderSearchHistory();
        this.updateWishlistCount();
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.priceRange = document.getElementById('priceRange');
        this.minRating = document.getElementById('minRating');
        this.sortBy = document.getElementById('sortBy');
        this.inStock = document.getElementById('inStock');
        this.loadingState = document.getElementById('loadingState');
        this.resultsSection = document.getElementById('resultsSection');
        this.emptyState = document.getElementById('emptyState');
        this.productGrid = document.getElementById('productGrid');
        this.resultsCount = document.getElementById('resultsCount');
        this.modal = document.getElementById('productModal');
        this.closeModal = document.getElementById('closeModal');
        this.modalBody = document.getElementById('modalBody');
    }

    attachEventListeners() {
        this.searchBtn.addEventListener('click', () => this.performSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        [this.priceRange, this.minRating, this.sortBy, this.inStock].forEach(element => {
            element.addEventListener('change', () => {
                if (this.currentResults.length > 0) {
                    this.applyFiltersAndDisplay();
                }
            });
        });

        this.closeModal.addEventListener('click', () => this.hideModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hideModal();
        });
    }

    loadSearchHistory() {
        try {
            return JSON.parse(localStorage.getItem('searchHistory')) || [];
        } catch {
            return [];
        }
    }

    saveSearchHistory() {
        localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    }

    addToSearchHistory(query) {
        if (!query || query.trim().length < 2) return;
        
        // Remove duplicates
        this.searchHistory = this.searchHistory.filter(item => item.query !== query);
        
        // Add to beginning
        this.searchHistory.unshift({
            query: query,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 10
        this.searchHistory = this.searchHistory.slice(0, 10);
        
        this.saveSearchHistory();
        this.renderSearchHistory();
    }

    clearSearchHistory() {
        this.searchHistory = [];
        this.saveSearchHistory();
        this.renderSearchHistory();
    }

    loadWishlist() {
        try {
            return JSON.parse(localStorage.getItem('wishlist')) || [];
        } catch {
            return [];
        }
    }

    saveWishlist() {
        localStorage.setItem('wishlist', JSON.stringify(this.wishlist));
        this.updateWishlistCount();
    }

    updateWishlistCount() {
        const counter = document.getElementById('wishlistCount');
        if (counter) {
            counter.textContent = this.wishlist.length;
        }
    }

    toggleWishlist(product) {
        const index = this.wishlist.findIndex(item => item.id === product.id);
        
        if (index > -1) {
            this.wishlist.splice(index, 1);
        } else {
            this.wishlist.push({
                id: product.id,
                title: product.title,
                price: product.price,
                image: product.image,
                store: product.store,
                link: product.productUrl || product.storeUrl || '',
                productUrl: product.productUrl || product.storeUrl || '',
                storeUrl: product.storeUrl || '',
                addedAt: new Date().toISOString()
            });
        }
        
        this.saveWishlist();
        
        // Re-render products to update heart icons
        if (this.currentResults.length > 0) {
            this.applyFiltersAndDisplay();
        }
    }

    isInWishlist(productId) {
        return this.wishlist.some(item => item.id === productId);
    }

    showWelcomeMessage() {
        this.emptyState.innerHTML = `
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <h3>Bine ai venit la PulsePrice! 🇲🇩</h3>
            <p>Căutăm produsele în <strong>Darwin, Cactus, Bomba și PandaShop</strong></p>
            <p style="margin-top: 0.5rem; color: var(--text-muted);">
                Prețuri în <strong>Lei MDL</strong> • Analiză AI • Comparare automată
            </p>
            <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <button onclick="app.searchInput.value='laptop'; app.performSearch();" 
                        style="background: var(--primary-color); color: white; border: none; 
                               padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer;">
                    Caută Laptop
                </button>
                <button onclick="app.searchInput.value='telefon'; app.performSearch();" 
                        style="background: var(--secondary-color); color: white; border: none; 
                               padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer;">
                    Caută Telefon
                </button>
                <button onclick="app.searchInput.value='televizor'; app.performSearch();" 
                        style="background: var(--success-color); color: white; border: none; 
                               padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer;">
                    Caută Televizor
                </button>
            </div>
        `;
    }

    async performSearch() {
        const query = this.searchInput.value.trim();
        
        if (!query) {
            alert('Te rog introdu un termen de căutare');
            return;
        }

        // Add to search history
        this.addToSearchHistory(query);

        this.showLoading();

        try {
            // Scrape toate magazinele
            const products = await this.scraper.scrapeAllStores(query);
            const normalizedProducts = products.map((product, index) => this.normalizeProduct(product, index));
            
            if (normalizedProducts.length === 0) {
                this.hideLoading();
                this.showNoResults(query);
                return;
            }

            this.products = normalizedProducts;
            this.currentResults = normalizedProducts;
            this.scoredResults = [];
            
            // Așteaptă un pic pentru efectul de procesare AI
            await new Promise(resolve => setTimeout(resolve, 800));
            
            this.applyFiltersAndDisplay();
        } catch (error) {
            console.error('Error during search:', error);
            this.hideLoading();
            this.showError();
        }
    }

    applyFiltersAndDisplay() {
        const filters = {
            maxPrice: this.priceRange.value ? parseFloat(this.priceRange.value) : null,
            minRating: parseFloat(this.minRating.value),
            inStock: this.inStock.checked,
            sortBy: this.sortBy.value
        };

        const query = this.searchInput.value.trim();
        const recommendations = this.recommendationEngine.recommendProducts(
            this.currentResults,
            query,
            filters
        );

        this.scoredResults = recommendations;
        this.displayResults(recommendations);
    }

    normalizeProduct(product, index = 0) {
        const safePrice = Number(product?.price);
        const safeRating = Number(product?.rating);
        const safeReviewCount = Number(product?.reviewCount ?? product?.reviews ?? 0);
        const sourceStore = String(product?.store || 'Magazin');
        const cleanStore = sourceStore.replace(/\.md$/i, '');

        return {
            ...product,
            id: product?.id || `${cleanStore}_${Date.now()}_${index}`,
            title: product?.title || 'Produs fără titlu',
            description: product?.description || product?.title || '',
            price: Number.isFinite(safePrice) ? safePrice : 0,
            rating: Number.isFinite(safeRating) ? safeRating : 0,
            reviewCount: Number.isFinite(safeReviewCount) ? safeReviewCount : 0,
            store: cleanStore,
            storeUrl: product?.storeUrl || '',
            productUrl: product?.productUrl || product?.link || product?.storeUrl || '',
            image: product?.image || 'https://via.placeholder.com/400x300/1e293b/6366f1?text=Produs',
            inStock: Boolean(product?.inStock),
            reviews: Array.isArray(product?.reviews) ? product.reviews : [],
            specs: Array.isArray(product?.specs) ? product.specs : []
        };
    }

    displayResults(products) {
        this.hideLoading();
        this.emptyState.classList.add('hidden');

        if (products.length === 0) {
            this.resultsSection.classList.add('hidden');
            this.showNoResults(this.searchInput.value);
            return;
        }

        this.resultsSection.classList.remove('hidden');
        this.resultsCount.textContent = `${products.length} produse găsite în ${new Set(products.map(p => p.store)).size} magazine`;
        this.productGrid.innerHTML = '';

        products.forEach((product, index) => {
            const card = this.createProductCard(product, index + 1);
            this.productGrid.appendChild(card);
        });

        // Scroll to results
        this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    createProductCard(product, rank) {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        const reasons = this.recommendationEngine.generateExplanation(product);
        const scoreColor = product.recommendationScore >= 80 ? '#10b981' : 
                          product.recommendationScore >= 60 ? '#f59e0b' : '#6366f1';

        // Emoji pentru magazine
        const storeEmoji = {
            'Darwin': '🦎',
            'Cactus': '🌵',
            'Bomba': '💣',
            'PandaShop': '🐼'
        };

        const isWishlisted = this.isInWishlist(product.id);

        card.innerHTML = `
            <div class="product-badge" style="background: ${scoreColor}">
                <span>🏆 #${rank}</span>
                <span>${product.recommendationScore}/100</span>
            </div>
            <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-product-id="${product.id}" title="${isWishlisted ? 'Elimină din favorite' : 'Adaugă la favorite'}">
                ${isWishlisted ? '❤️' : '🤍'}
            </button>
            <img src="${product.image}" alt="${product.title}" class="product-image" onerror="this.src='https://via.placeholder.com/400x300/1e293b/6366f1?text=Produs'">
            <div class="product-content">
                <span class="product-store">${storeEmoji[product.store] || '🏪'} ${product.store}</span>
                <h3 class="product-title">${product.title}</h3>
                <div class="product-rating">
                    <span class="stars">${this.generateStars(product.rating)}</span>
                    <span class="rating-text">${Number(product.rating || 0).toFixed(1)} (${product.reviewCount || 0} recenzii)</span>
                </div>
                <div class="product-features">
                    ${reasons.slice(0, 2).map(reason => 
                        `<span class="feature-tag">✓ ${reason}</span>`
                    ).join('')}
                </div>
                ${!product.inStock ? '<div style="color: var(--danger-color); font-weight: 600; margin-top: 0.5rem;">⚠️ Indisponibil</div>' : ''}
                <div class="product-footer">
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Preț</div>
                        <span class="product-price">${this.formatPrice(product.price)}</span>
                    </div>
                        <button class="product-btn">Detalii →</button>
                </div>
            </div>
        `;

            // Wishlist button
            const wishlistBtn = card.querySelector('.wishlist-btn');
            wishlistBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleWishlist(product);
            });

            // Card click opens original product page (unless user clicked the details button)
            card.addEventListener('click', (e) => {
                if (e.target.closest('.product-btn')) return; // allow button to handle details
                const url = product.productUrl || product.storeUrl;
                if (url) window.open(url, '_blank');
            });

            // Details button opens modal (stop propagation so card click doesn't fire)
            const btn = card.querySelector('.product-btn');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showProductDetails(product.id);
                });
            }

            return card;
    }

    generateStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        return '⭐'.repeat(fullStars) + 
               (hasHalfStar ? '✨' : '') + 
               '☆'.repeat(emptyStars);
    }

    formatPrice(price) {
        const safePrice = Number(price);
        return `${(Number.isFinite(safePrice) ? safePrice : 0).toLocaleString('ro-MD')} ${this.currency}`;
    }

    showProductDetails(productId) {
        const product = [...this.scoredResults, ...this.currentResults, ...this.products].find(p => p.id === productId);
        if (!product) return;

        const similar = this.recommendationEngine.findSimilarProducts(
            product,
            this.products,
            3
        );

        const storeEmoji = {
            'Darwin': '🦎',
            'Cactus': '🌵',
            'Bomba': '💣',
            'PandaShop': '🐼'
        };

        const scoreBreakdown = product.scoreBreakdown || {
            price: 0,
            rating: 0,
            reviews: 0,
            availability: product.inStock ? 100 : 0,
            relevance: 0
        };

        this.modalBody.innerHTML = `
            <div style="padding: 2rem;">
                <img src="${product.image}" alt="${product.title}" 
                     style="width: 100%; height: 300px; object-fit: cover; border-radius: 1rem; margin-bottom: 1.5rem;"
                     onerror="this.src='https://via.placeholder.com/800x300/1e293b/6366f1?text=Produs'">
                
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; gap: 1rem;">
                    <div style="flex: 1;">
                        <span style="background: var(--background); padding: 0.5rem 1rem; border-radius: 0.5rem; 
                                     font-size: 1rem; color: var(--text-secondary); display: inline-block;">
                            ${storeEmoji[product.store] || '🏪'} ${product.store}
                        </span>
                        <h2 style="margin-top: 1rem; color: var(--text-primary); font-size: 1.5rem; line-height: 1.4;">
                            ${product.title}
                        </h2>
                    </div>
                    <div style="text-align: right; background: var(--background); padding: 1rem; border-radius: 1rem;">
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            Scor AI
                        </div>
                        <div style="font-size: 2.5rem; font-weight: 700; color: var(--success-color);">
                            ${product.recommendationScore}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">din 100</div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="color: var(--warning-color); font-size: 1.3rem;">
                            ${this.generateStars(product.rating)}
                        </span>
                        <span style="color: var(--text-secondary); font-weight: 600;">
                            ${product.rating.toFixed(1)}
                        </span>
                    </div>
                    <span style="color: var(--text-muted);">•</span>
                    <span style="color: var(--text-secondary);">
                        ${product.reviewCount || 0} recenzii
                    </span>
                    <span style="margin-left: auto; background: ${product.inStock ? 'var(--success-color)' : 'var(--danger-color)'}; 
                                 padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.9rem; font-weight: 600;">
                        ${product.inStock ? '✓ În stoc' : '✗ Indisponibil'}
                    </span>
                </div>

                <p style="color: var(--text-secondary); line-height: 1.8; margin-bottom: 2rem;">
                    ${product.description}
                </p>

                ${product.specs && product.specs.length > 0 ? `
                    <div style="background: var(--background); padding: 1.5rem; border-radius: 1rem; margin-bottom: 2rem;">
                        <h3 style="margin-bottom: 1rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                            <span>⚙️</span> Specificații Tehnice
                        </h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                            ${product.specs.map(spec => `
                                <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary);">
                                    <span style="color: var(--primary-color);">▪</span>
                                    <span>${spec}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div style="background: var(--background); padding: 1.5rem; border-radius: 1rem; margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1.5rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                        <span>🤖</span> Analiza AI
                    </h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1.5rem;">
                        ${Object.entries(scoreBreakdown).filter(([key]) => key !== 'sentiment').map(([key, value]) => `
                            <div style="text-align: center; background: var(--surface); padding: 1rem; border-radius: 0.75rem;">
                                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem;">
                                    ${this.translateScoreKey(key)}
                                </div>
                                <div style="font-size: 1.8rem; font-weight: 700; color: ${value >= 70 ? 'var(--success-color)' : value >= 50 ? 'var(--warning-color)' : 'var(--danger-color)'};">
                                    ${value}%
                                </div>
                                <div style="margin-top: 0.5rem;">
                                    <div style="background: var(--background); height: 6px; border-radius: 3px; overflow: hidden;">
                                        <div style="background: ${value >= 70 ? 'var(--success-color)' : value >= 50 ? 'var(--warning-color)' : 'var(--danger-color)'}; 
                                                    height: 100%; width: ${value}%; transition: width 0.5s ease;"></div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                ${similar.length > 0 ? `
                    <div style="margin-bottom: 2rem;">
                        <h3 style="margin-bottom: 1rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                            <span>🔗</span> Produse Similare
                        </h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                            ${similar.map(p => `
                                <div style="background: var(--background); padding: 1rem; border-radius: 0.75rem; cursor: pointer; 
                                            transition: all 0.3s ease; border: 1px solid var(--border-color);"
                                     onmouseover="this.style.borderColor='var(--primary-color)'; this.style.transform='translateY(-2px)'"
                                     onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='translateY(0)'"
                                     onclick="app.showProductDetails('${p.id}')">
                                    <img src="${p.image}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 0.5rem; margin-bottom: 0.75rem;"
                                         onerror="this.src='https://via.placeholder.com/200x120/1e293b/6366f1?text=Produs'">
                                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                                        ${storeEmoji[p.store] || '🏪'} ${p.store}
                                    </div>
                                    <div style="font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.5rem; 
                                                display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; 
                                                overflow: hidden; line-height: 1.3;">
                                        ${p.title}
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="font-weight: 700; color: var(--success-color); font-size: 1.1rem;">
                                            ${this.formatPrice(p.price)}
                                        </div>
                                        <div style="color: var(--warning-color); font-size: 0.9rem;">
                                            ${this.generateStars(p.rating)}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div style="display: flex; gap: 1rem; padding-top: 1.5rem; border-top: 2px solid var(--border-color);">
                    <div style="flex: 1; text-align: center; background: var(--background); padding: 1.5rem; border-radius: 1rem;">
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Preț</div>
                        <div style="font-size: 2.5rem; font-weight: 700; color: var(--success-color);">
                            ${this.formatPrice(product.price)}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">Lei moldovenești</div>
                    </div>
                    <button style="flex: 1; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); 
                                   color: white; border: none; padding: 1.5rem; border-radius: 1rem; font-size: 1.2rem; 
                                   font-weight: 600; cursor: pointer; transition: all 0.3s ease;"
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 25px rgba(99, 102, 241, 0.3)'"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
                            onclick="window.open('${product.productUrl || product.storeUrl}', '_blank')">
                        ${storeEmoji[product.store] || '🏪'} Vezi în ${product.store} →
                    </button>
                </div>
            </div>
        `;

        this.modal.classList.remove('hidden');
    }

    translateScoreKey(key) {
        const translations = {
            price: 'Preț',
            rating: 'Rating',
            reviews: 'Recenzii',
            availability: 'Disponibil',
            relevance: 'Relevanță'
        };
        return translations[key] || key;
    }

    showLoading() {
        this.loadingState.innerHTML = `
            <div class="spinner"></div>
            <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">
                Analizez produsele cu AI...
            </p>
            <p style="color: var(--text-muted); font-size: 0.95rem;">
                Caut în Darwin 🦎, Cactus 🌵, Bomba 💣 și PandaShop 🐼
            </p>
        `;
        this.loadingState.classList.remove('hidden');
        this.resultsSection.classList.add('hidden');
        this.emptyState.classList.add('hidden');
    }

    hideLoading() {
        this.loadingState.classList.add('hidden');
    }

    showNoResults(query) {
        this.emptyState.innerHTML = `
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="2"/>
                <path d="M12 8v4m0 4h.01" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <h3>Nu am găsit rezultate pentru "${query}"</h3>
            <p>Încearcă să modifici termenii de căutare sau filtrele</p>
            <button onclick="app.searchInput.value=''; app.showWelcomeMessage();" 
                    style="margin-top: 1rem; background: var(--primary-color); color: white; 
                           border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer;">
                Întoarce-te la început
            </button>
        `;
        this.emptyState.classList.remove('hidden');
    }

    showError() {
        this.emptyState.innerHTML = `
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="2"/>
                <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/>
                <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <h3>Oops! A apărut o eroare</h3>
            <p>Te rog încearcă din nou într-un moment</p>
        `;
        this.emptyState.classList.remove('hidden');
    }

    hideModal() {
        this.modal.classList.add('hidden');
    }

    renderSearchHistory() {
        const historyContainer = document.getElementById('searchHistory');
        if (!historyContainer) return;

        if (this.searchHistory.length === 0) {
            historyContainer.style.display = 'none';
            return;
        }

        historyContainer.style.display = 'block';
        const historyList = historyContainer.querySelector('.history-list');
        
        historyList.innerHTML = this.searchHistory.map(item => `
            <button class="history-item" onclick="app.searchInput.value='${item.query}'; app.performSearch();">
                <span class="history-icon">🔍</span>
                <span class="history-query">${item.query}</span>
                <span class="history-time">${this.formatTimeAgo(item.timestamp)}</span>
            </button>
        `).join('');
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'acum';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ore`;
        return `${Math.floor(diffInSeconds / 86400)} zile`;
    }

    showWishlistModal() {
        if (this.wishlist.length === 0) {
            alert('Nu ai produse în lista de favorite!');
            return;
        }

        this.modalBody.innerHTML = `
            <div style="padding: 2rem;">
                <h2 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    ❤️ Lista de Favorite (${this.wishlist.length})
                </h2>
                <div style="display: grid; gap: 1rem;">
                    ${this.wishlist.map(item => `
                        <div style="display: flex; gap: 1rem; padding: 1rem; background: var(--card-bg); border-radius: 0.75rem; border: 1px solid var(--border-color);">
                            <img src="${item.image}" alt="${item.title}" 
                                 style="width: 80px; height: 80px; object-fit: contain; border-radius: 0.5rem; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; margin-bottom: 0.5rem;">${item.title}</div>
                                <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">${item.store}</div>
                                <div style="font-size: 1.1rem; font-weight: 700; color: var(--primary-color);">${this.formatPrice(item.price)}</div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <button onclick="window.open('${item.productUrl || item.link || item.storeUrl || '#'}', '_blank')" 
                                        style="background: var(--primary-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; white-space: nowrap;">
                                    Vezi Produs
                                </button>
                                <button onclick="app.removeFromWishlist('${item.id}')" 
                                        style="background: var(--danger-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">
                                    Elimină
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button onclick="app.clearWishlist()" 
                        style="margin-top: 1.5rem; background: var(--danger-color); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; width: 100%;">
                    Șterge toate favoritele
                </button>
            </div>
        `;
        this.modal.classList.remove('hidden');
    }

    removeFromWishlist(productId) {
        const product = this.wishlist.find(item => item.id === productId);
        if (product) {
            this.toggleWishlist(product);
            this.showWishlistModal(); // Refresh modal
        }
    }

    clearWishlist() {
        if (confirm('Sigur vrei să ștergi toate produsele din lista de favorite?')) {
            this.wishlist = [];
            this.saveWishlist();
            this.hideModal();
            if (this.currentResults.length > 0) {
                this.applyFiltersAndDisplay();
            }
        }
    }
}

// Inițializare aplicație
function initAuthUi(user) {
    const userEl = document.getElementById('currentUserName');
    const logoutBtn = document.getElementById('logoutBtn');

    if (userEl) {
        const name = user?.displayName || user?.email || 'Utilizator';
        userEl.textContent = `Cont: ${name}`;
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            firebase.auth().signOut().finally(() => {
                window.location.href = 'login.html';
            });
        });
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    if (!window.firebase || !firebase.auth) {
        alert('Firebase nu este initializat. Verifica firebase-config.js');
        window.location.href = 'login.html';
        return;
    }

    let initialized = false;
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        initAuthUi(user);
        if (!initialized) {
            initialized = true;
            app = new SmartShopApp();
            console.log('🇲🇩 PulsePrice Moldova initialized!');
            console.log('Searching in: Darwin, Cactus, Bomba, PandaShop');
        }
    });
});
