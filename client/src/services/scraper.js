// Web Scraper pentru magazinele din Moldova
class ProductScraper {
    constructor() {
        this.remoteApiBaseUrl = 'https://pricepulse-api.onrender.com';
        this.apiBaseUrl = this.resolveApiBaseUrl();
        this.stores = {
            darwin: {
                name: 'Darwin',
                url: 'https://darwin.md',
                selectors: {
                    // Vom adapta selectorii după structura reală
                    product: '.product-item',
                    title: '.product-title',
                    price: '.product-price',
                    rating: '.rating',
                    image: '.product-image img'
                }
            },
            cactus: {
                name: 'Cactus',
                url: 'https://www.cactus.md',
                selectors: {
                    product: '.product-card',
                    title: '.product-name',
                    price: '.price',
                    rating: '.stars',
                    image: '.product-img'
                }
            },
            bomba: {
                name: 'Bomba',
                url: 'https://bomba.md',
                selectors: {
                    product: '.product',
                    title: 'h3',
                    price: '.price-new',
                    rating: '.rating-stars',
                    image: '.product-image img'
                }
            },
            pandashop: {
                name: 'PandaShop',
                url: 'https://www.pandashop.md',
                selectors: {
                    product: '.item',
                    title: '.item-title',
                    price: '.item-price',
                    rating: '.item-rating',
                    image: '.item-img img'
                }
            }
        };
    }

    resolveApiBaseUrl() {
        // Allow manual override from HTML before loading scraper.js:
        // window.PRICEPULSE_API_URL = 'https://...'
        if (typeof window !== 'undefined' && window.PRICEPULSE_API_URL) {
            return String(window.PRICEPULSE_API_URL).replace(/\/+$/, '');
        }

        if (typeof window !== 'undefined') {
            const host = window.location.hostname;
            if (host === 'localhost' || host === '127.0.0.1') {
                return 'http://localhost:3000';
            }
        }

        return this.remoteApiBaseUrl;
    }

    // Metodă pentru a face request cross-origin (în producție se va folosi un backend)
    async fetchWithProxy(url) {
        // Pentru development, vom folosi un proxy CORS
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        try {
            const response = await fetch(proxyUrl + encodeURIComponent(url));
            return await response.text();
        } catch (error) {
            console.error('Error fetching:', error);
            return null;
        }
    }

    // Extrage prețul din text
    extractPrice(priceText) {
        if (!priceText) return 0;
        // Extrage doar numerele
        const price = priceText.replace(/[^\d.,]/g, '').replace(',', '.');
        return parseFloat(price) || 0;
    }

    // Extrage rating din text sau număr de stele
    extractRating(ratingElement) {
        if (!ratingElement) return 0;
        
        // Încearcă să găsească numărul direct
        const ratingText = ratingElement.textContent || ratingElement;
        const ratingMatch = ratingText.match(/[\d.]+/);
        if (ratingMatch) {
            return parseFloat(ratingMatch[0]);
        }

        // Numără stelele pline
        const filledStars = ratingElement.querySelectorAll?.('.filled, .active, .fa-star:not(.fa-star-o)');
        if (filledStars) {
            return filledStars.length;
        }

        return 0;
    }

    // Scrape pentru Darwin.md
    async scrapeDarwin(searchQuery) {
        console.log('Scraping Darwin.md...');
        // URL-ul de căutare pentru Darwin
        const searchUrl = `${this.stores.darwin.url}/ro/search?q=${encodeURIComponent(searchQuery)}`;
        // În producție, încercăm să parsam pagina de căutare folosind proxy CORS
        try {
            const html = await this.fetchWithProxy(searchUrl);
            if (!html) return this.simulateDarwinProducts(searchQuery);

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const items = Array.from(doc.querySelectorAll(this.stores.darwin.selectors.product));

            if (items.length === 0) return this.simulateDarwinProducts(searchQuery);

            const results = items.map((el, i) => {
                const titleEl = el.querySelector(this.stores.darwin.selectors.title);
                const priceEl = el.querySelector(this.stores.darwin.selectors.price);
                const imgEl = el.querySelector(this.stores.darwin.selectors.image);
                const linkEl = el.querySelector('a') || el.querySelector(this.stores.darwin.selectors.title + ' a');

                const title = titleEl ? titleEl.textContent.trim() : (el.textContent || '').trim();
                const price = priceEl ? this.extractPrice(priceEl.textContent) : 0;
                let image = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
                let productUrl = linkEl ? (linkEl.getAttribute('href') || '') : '';

                // Normalizează URL imagine și produs
                if (image && image.startsWith('//')) image = 'https:' + image;
                if (image && image.startsWith('/')) image = this.stores.darwin.url + image;
                if (productUrl && productUrl.startsWith('/')) productUrl = this.stores.darwin.url + productUrl;

                return {
                    id: `darwin_scraped_${i}`,
                    title: title,
                    description: title,
                    price: price,
                    rating: 0,
                    reviewCount: 0,
                    store: 'Darwin',
                    storeUrl: this.stores.darwin.url,
                    productUrl: productUrl || this.stores.darwin.url,
                    image: image || 'https://via.placeholder.com/400x300/1e293b/6366f1?text=Produs',
                    inStock: true,
                    reviews: [],
                    specs: []
                };
            });

            return results;
        } catch (err) {
            console.warn('Darwin scrape failed, falling back to simulated data', err);
            return this.simulateDarwinProducts(searchQuery);
        }
    }

    // Scrape pentru Cactus.md
    async scrapeCactus(searchQuery) {
        console.log('Scraping Cactus.md...');
        const searchUrl = `${this.stores.cactus.url}/search?q=${encodeURIComponent(searchQuery)}`;
        try {
            const html = await this.fetchWithProxy(searchUrl);
            if (!html) return this.simulateCactusProducts(searchQuery);

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const items = Array.from(doc.querySelectorAll(this.stores.cactus.selectors.product));
            if (items.length === 0) return this.simulateCactusProducts(searchQuery);

            return items.map((el, i) => {
                const titleEl = el.querySelector(this.stores.cactus.selectors.title);
                const priceEl = el.querySelector(this.stores.cactus.selectors.price);
                const imgEl = el.querySelector(this.stores.cactus.selectors.image);
                const linkEl = el.querySelector('a');

                let image = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
                let productUrl = linkEl ? (linkEl.getAttribute('href') || '') : '';
                if (image && image.startsWith('//')) image = 'https:' + image;
                if (image && image.startsWith('/')) image = this.stores.cactus.url + image;
                if (productUrl && productUrl.startsWith('/')) productUrl = this.stores.cactus.url + productUrl;

                return {
                    id: `cactus_scraped_${i}`,
                    title: titleEl ? titleEl.textContent.trim() : (el.textContent || '').trim(),
                    description: '',
                    price: priceEl ? this.extractPrice(priceEl.textContent) : 0,
                    rating: 0,
                    reviewCount: 0,
                    store: 'Cactus',
                    storeUrl: this.stores.cactus.url,
                    productUrl: productUrl || this.stores.cactus.url,
                    image: image || 'https://via.placeholder.com/400x300/1e293b/6366f1?text=Produs',
                    inStock: true,
                    reviews: [],
                    specs: []
                };
            });
        } catch (err) {
            console.warn('Cactus scrape failed, falling back to simulated data', err);
            return this.simulateCactusProducts(searchQuery);
        }
    }

    // Scrape pentru Bomba.md
    async scrapeBomba(searchQuery) {
        console.log('Scraping Bomba.md...');
        const searchUrl = `${this.stores.bomba.url}/search?search=${encodeURIComponent(searchQuery)}`;
        try {
            const html = await this.fetchWithProxy(searchUrl);
            if (!html) return this.simulateBombaProducts(searchQuery);

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const items = Array.from(doc.querySelectorAll(this.stores.bomba.selectors.product));
            if (items.length === 0) return this.simulateBombaProducts(searchQuery);

            return items.map((el, i) => {
                const titleEl = el.querySelector(this.stores.bomba.selectors.title);
                const priceEl = el.querySelector(this.stores.bomba.selectors.price);
                const imgEl = el.querySelector(this.stores.bomba.selectors.image);
                const linkEl = el.querySelector('a');

                let image = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
                let productUrl = linkEl ? (linkEl.getAttribute('href') || '') : '';
                if (image && image.startsWith('//')) image = 'https:' + image;
                if (image && image.startsWith('/')) image = this.stores.bomba.url + image;
                if (productUrl && productUrl.startsWith('/')) productUrl = this.stores.bomba.url + productUrl;

                return {
                    id: `bomba_scraped_${i}`,
                    title: titleEl ? titleEl.textContent.trim() : (el.textContent || '').trim(),
                    description: '',
                    price: priceEl ? this.extractPrice(priceEl.textContent) : 0,
                    rating: 0,
                    reviewCount: 0,
                    store: 'Bomba',
                    storeUrl: this.stores.bomba.url,
                    productUrl: productUrl || this.stores.bomba.url,
                    image: image || 'https://via.placeholder.com/400x300/1e293b/6366f1?text=Produs',
                    inStock: true,
                    reviews: [],
                    specs: []
                };
            });
        } catch (err) {
            console.warn('Bomba scrape failed, falling back to simulated data', err);
            return this.simulateBombaProducts(searchQuery);
        }
    }

    // Scrape pentru PandaShop.md
    async scrapePandaShop(searchQuery) {
        console.log('Scraping PandaShop.md...');
        const searchUrl = `${this.stores.pandashop.url}/ru/search?q=${encodeURIComponent(searchQuery)}`;
        try {
            const html = await this.fetchWithProxy(searchUrl);
            if (!html) return this.simulatePandaShopProducts(searchQuery);

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const items = Array.from(doc.querySelectorAll(this.stores.pandashop.selectors.product));
            if (items.length === 0) return this.simulatePandaShopProducts(searchQuery);

            return items.map((el, i) => {
                const titleEl = el.querySelector(this.stores.pandashop.selectors.title);
                const priceEl = el.querySelector(this.stores.pandashop.selectors.price);
                const imgEl = el.querySelector(this.stores.pandashop.selectors.image);
                const linkEl = el.querySelector('a');

                let image = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
                let productUrl = linkEl ? (linkEl.getAttribute('href') || '') : '';
                if (image && image.startsWith('//')) image = 'https:' + image;
                if (image && image.startsWith('/')) image = this.stores.pandashop.url + image;
                if (productUrl && productUrl.startsWith('/')) productUrl = this.stores.pandashop.url + productUrl;

                return {
                    id: `panda_scraped_${i}`,
                    title: titleEl ? titleEl.textContent.trim() : (el.textContent || '').trim(),
                    description: '',
                    price: priceEl ? this.extractPrice(priceEl.textContent) : 0,
                    rating: 0,
                    reviewCount: 0,
                    store: 'PandaShop',
                    storeUrl: this.stores.pandashop.url,
                    productUrl: productUrl || this.stores.pandashop.url,
                    image: image || 'https://via.placeholder.com/400x300/1e293b/6366f1?text=Produs',
                    inStock: true,
                    reviews: [],
                    specs: []
                };
            });
        } catch (err) {
            console.warn('PandaShop scrape failed, falling back to simulated data', err);
            return this.simulatePandaShopProducts(searchQuery);
        }
    }

    // Funcție principală care scrapuiește toate magazinele
    async scrapeAllStores(searchQuery) {
        console.log(`Searching for: "${searchQuery}" in all stores...`);
        console.log(`API backend: ${this.apiBaseUrl}`);
        
        // Încearcă să folosească backend-ul local Puppeteer
        try {
            console.log('🚀 Încercăm backend-ul Puppeteer...');
            const response = await fetch(`${this.apiBaseUrl}/search?q=${encodeURIComponent(searchQuery)}&ai=1`);
            
            console.log(`📡 Response status: ${response.status}`);
            
            if (response.ok) {
                const products = await response.json();
                console.log(`✅ Backend-ul a returnat ${products.length} produse reale!`);
                console.log('📦 Primele 3 produse:', products.slice(0, 3));
                
                // RETURNĂM DIRECT produsele de la backend, chiar dacă sunt 0
                return products;
            } else {
                console.log(`⚠️ Backend error: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log('❌ Backend-ul nu răspunde:', error.message);
            console.log('📊 Folosim date simulate pentru demonstrație...');
        }
        
        // Fallback la date simulate DOAR dacă backend-ul chiar nu răspunde
        const results = await Promise.all([
            this.scrapeDarwin(searchQuery),
            this.scrapeCactus(searchQuery),
            this.scrapeBomba(searchQuery),
            this.scrapePandaShop(searchQuery)
        ]);

        // Combină rezultatele
        return results.flat();
    }

    // Date simulate pentru Darwin (vor fi înlocuite cu scraping real)
    simulateDarwinProducts(query) {
        const products = [
            {
                id: 'darwin_1',
                title: 'Laptop ASUS VivoBook 15, Intel Core i5-1135G7, 8GB RAM, 512GB SSD',
                description: 'Laptop performant pentru uz zilnic, procesor Intel Core i5 generația 11, display Full HD de 15.6", perfect pentru muncă și multimedia',
                price: 8999,
                rating: 4.5,
                reviewCount: 87,
                store: 'Darwin',
                storeUrl: 'https://darwin.md',
                productUrl: 'https://darwin.md/product/darwin_1',
                image: 'https://via.placeholder.com/400x300/1e293b/6366f1?text=ASUS+VivoBook',
                inStock: true,
                reviews: ['Laptop excelent pentru birou', 'Foarte rapid și silențios', 'Baterie bună'],
                specs: ['Intel Core i5-1135G7', '8GB RAM', '512GB SSD', 'Windows 11']
            },
            {
                id: 'darwin_2',
                title: 'Laptop Lenovo IdeaPad 3, AMD Ryzen 5 5500U, 16GB RAM, 512GB SSD',
                description: 'Laptop cu procesor AMD Ryzen 5, memorie generoasă de 16GB, ideal pentru multitasking și aplicații office',
                price: 7499,
                rating: 4.3,
                reviewCount: 64,
                store: 'Darwin',
                storeUrl: 'https://darwin.md',
                productUrl: 'https://darwin.md/product/darwin_2',
                image: 'https://via.placeholder.com/400x300/1e293b/8b5cf6?text=Lenovo+IdeaPad',
                inStock: true,
                reviews: ['Raport calitate-preț bun', 'Performanțe solide pentru preț'],
                specs: ['AMD Ryzen 5 5500U', '16GB RAM', '512GB SSD', 'FreeDOS']
            },
            {
                id: 'darwin_3',
                title: 'Laptop HP 250 G8, Intel Core i3-1115G4, 8GB RAM, 256GB SSD',
                description: 'Laptop business accesibil, procesor Intel Core i3, compact și ușor, perfect pentru mobilitate',
                price: 6299,
                rating: 4.0,
                reviewCount: 42,
                store: 'Darwin',
                storeUrl: 'https://darwin.md',
                productUrl: 'https://darwin.md/product/darwin_3',
                image: 'https://via.placeholder.com/400x300/1e293b/10b981?text=HP+250',
                inStock: true,
                reviews: ['Bun pentru muncă', 'Portabil și eficient'],
                specs: ['Intel Core i3-1115G4', '8GB RAM', '256GB SSD', 'Windows 11']
            }
        ];

        return products.filter(p => 
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.description.toLowerCase().includes(query.toLowerCase())
        );
    }

    simulateCactusProducts(query) {
        const products = [
            {
                id: 'cactus_1',
                title: 'Laptop ASUS TUF Gaming F15, Intel Core i7-11800H, 16GB RAM, 512GB SSD, RTX 3050',
                description: 'Laptop gaming robust cu procesor Intel Core i7, placa video RTX 3050, ecran 144Hz, ideal pentru gaming și design',
                price: 12999,
                rating: 4.7,
                reviewCount: 125,
                store: 'Cactus',
                storeUrl: 'https://www.cactus.md',
                productUrl: 'https://www.cactus.md/product/cactus_1',
                image: 'https://via.placeholder.com/400x300/1e293b/f59e0b?text=ASUS+TUF+Gaming',
                inStock: true,
                reviews: ['Gaming excelent', 'Calitate construcție foarte bună', 'Performanțe de top'],
                specs: ['Intel Core i7-11800H', '16GB RAM', '512GB SSD', 'RTX 3050 4GB']
            },
            {
                id: 'cactus_2',
                title: 'Laptop Acer Aspire 5 A515, Intel Core i5-1135G7, 8GB RAM, 512GB SSD',
                description: 'Laptop versatil cu ecran Full HD IPS, procesor Intel Core i5, design elegant și subțire',
                price: 8299,
                rating: 4.4,
                reviewCount: 98,
                store: 'Cactus',
                storeUrl: 'https://www.cactus.md',
                productUrl: 'https://www.cactus.md/product/cactus_2',
                image: 'https://via.placeholder.com/400x300/1e293b/ef4444?text=Acer+Aspire+5',
                inStock: true,
                reviews: ['Foarte bun pentru prețul plătit', 'Ecran frumos', 'Rapid în lucru'],
                specs: ['Intel Core i5-1135G7', '8GB RAM', '512GB SSD', 'Intel Iris Xe']
            },
            {
                id: 'cactus_3',
                title: 'Laptop Dell Inspiron 15 3000, Intel Core i3-1115G4, 8GB RAM, 256GB SSD',
                description: 'Laptop Dell fiabil pentru uz de birou, construcție solidă, tastatură confortabilă',
                price: 6799,
                rating: 4.2,
                reviewCount: 56,
                store: 'Cactus',
                storeUrl: 'https://www.cactus.md',
                productUrl: 'https://www.cactus.md/product/cactus_3',
                image: 'https://via.placeholder.com/400x300/1e293b/06b6d4?text=Dell+Inspiron',
                inStock: true,
                reviews: ['Solid și fiabil', 'Bun pentru office'],
                specs: ['Intel Core i3-1115G4', '8GB RAM', '256GB SSD', 'Windows 11 Home']
            }
        ];

        return products.filter(p => 
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.description.toLowerCase().includes(query.toLowerCase())
        );
    }

    simulateBombaProducts(query) {
        const products = [
            {
                id: 'bomba_1',
                title: 'Laptop MSI Modern 14, Intel Core i5-1135G7, 8GB RAM, 512GB SSD',
                description: 'Ultrabook modern și subțire, procesor Intel Core i5, display Full HD, perfect pentru mobilitate și productivitate',
                price: 8499,
                rating: 4.6,
                reviewCount: 73,
                store: 'Bomba',
                storeUrl: 'https://bomba.md',
                productUrl: 'https://bomba.md/product/bomba_1',
                image: 'https://via.placeholder.com/400x300/1e293b/a855f7?text=MSI+Modern+14',
                inStock: true,
                reviews: ['Design elegant', 'Foarte portabil', 'Performanțe excelente'],
                specs: ['Intel Core i5-1135G7', '8GB RAM', '512GB SSD', '14" Full HD']
            },
            {
                id: 'bomba_2',
                title: 'Laptop Lenovo Legion 5, AMD Ryzen 5 5600H, 16GB RAM, 512GB SSD, GTX 1650',
                description: 'Laptop gaming cu procesor AMD Ryzen 5, placa video GTX 1650, sistem de răcire avansat',
                price: 11299,
                rating: 4.8,
                reviewCount: 156,
                store: 'Bomba',
                storeUrl: 'https://bomba.md',
                productUrl: 'https://bomba.md/product/bomba_2',
                image: 'https://via.placeholder.com/400x300/1e293b/f97316?text=Lenovo+Legion+5',
                inStock: true,
                reviews: ['Gaming foarte bun', 'Răcire excelentă', 'Recomand pentru gameri'],
                specs: ['AMD Ryzen 5 5600H', '16GB RAM', '512GB SSD', 'GTX 1650 4GB']
            },
            {
                id: 'bomba_3',
                title: 'Laptop HP Pavilion 15, Intel Core i7-1165G7, 16GB RAM, 512GB SSD',
                description: 'Laptop premium HP cu procesor Intel Core i7, memorie generoasă, design modern în argintiu',
                price: 10499,
                rating: 4.5,
                reviewCount: 89,
                store: 'Bomba',
                storeUrl: 'https://bomba.md',
                productUrl: 'https://bomba.md/product/bomba_3',
                image: 'https://via.placeholder.com/400x300/1e293b/14b8a6?text=HP+Pavilion+15',
                inStock: false,
                reviews: ['Foarte rapid', 'Design premium', 'Multitasking perfect'],
                specs: ['Intel Core i7-1165G7', '16GB RAM', '512GB SSD', 'Intel Iris Xe']
            }
        ];

        return products.filter(p => 
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.description.toLowerCase().includes(query.toLowerCase())
        );
    }

    simulatePandaShopProducts(query) {
        const products = [
            {
                id: 'panda_1',
                title: 'Laptop ASUS ZenBook 14, Intel Core i7-1165G7, 16GB RAM, 512GB SSD',
                description: 'Ultrabook premium cu ecran Full HD, construcție din aluminiu, procesor puternic Intel Core i7',
                price: 13499,
                rating: 4.9,
                reviewCount: 201,
                store: 'PandaShop',
                storeUrl: 'https://www.pandashop.md',
                productUrl: 'https://www.pandashop.md/product/panda_1',
                image: 'https://via.placeholder.com/400x300/1e293b/8b5cf6?text=ASUS+ZenBook',
                inStock: true,
                reviews: ['Cel mai bun laptop pe care l-am avut', 'Premium în toate privințele', 'Baterie incredibilă'],
                specs: ['Intel Core i7-1165G7', '16GB RAM', '512GB SSD', '14" Full HD']
            },
            {
                id: 'panda_2',
                title: 'Laptop Apple MacBook Air M1, 8GB RAM, 256GB SSD',
                description: 'Laptop Apple cu chip M1 revoluționar, design ultra-subțire, autonomie excepțională de peste 15 ore',
                price: 16999,
                rating: 5.0,
                reviewCount: 342,
                store: 'PandaShop',
                storeUrl: 'https://www.pandashop.md',
                productUrl: 'https://www.pandashop.md/product/panda_2',
                image: 'https://via.placeholder.com/400x300/1e293b/6366f1?text=MacBook+Air+M1',
                inStock: true,
                reviews: ['Perfect', 'Cel mai bun laptop', 'Baterie fenomenală', 'Silențios total'],
                specs: ['Apple M1 Chip', '8GB RAM', '256GB SSD', '13.3" Retina']
            },
            {
                id: 'panda_3',
                title: 'Laptop Acer Nitro 5, Intel Core i5-11400H, 16GB RAM, 512GB SSD, RTX 3050',
                description: 'Laptop gaming accesibil cu procesor Intel Core i5, placa video RTX 3050, display 144Hz',
                price: 11999,
                rating: 4.6,
                reviewCount: 167,
                store: 'PandaShop',
                storeUrl: 'https://www.pandashop.md',
                productUrl: 'https://www.pandashop.md/product/panda_3',
                image: 'https://via.placeholder.com/400x300/1e293b/ef4444?text=Acer+Nitro+5',
                inStock: true,
                reviews: ['Gaming foarte bun pentru preț', 'Performanțe solide', 'Recomand'],
                specs: ['Intel Core i5-11400H', '16GB RAM', '512GB SSD', 'RTX 3050 4GB']
            }
        ];

        return products.filter(p => 
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.description.toLowerCase().includes(query.toLowerCase())
        );
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductScraper;
}
