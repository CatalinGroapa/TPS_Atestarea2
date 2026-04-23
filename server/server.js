const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) return;

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    });
}

loadLocalEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Cache pentru 5 minute
const cache = new NodeCache({ stdTTL: 300 });

app.use(cors());
app.use(express.json());

const allowedImageHosts = new Set([
    'darwin.md',
    'www.cactus.md',
    'cactus.md',
    'bomba.md',
    'ultra.md',
    'cdn.ultra.md',
    'pandashop.md',
    'www.pandashop.md',
    'cdn.pandashop.md'
]);

function isAllowedImageHost(hostname) {
    if (!hostname) return false;
    const normalized = hostname.toLowerCase();
    if (allowedImageHosts.has(normalized)) return true;
    return Array.from(allowedImageHosts).some((host) => normalized.endsWith(`.${host}`));
}

function extractFirstJsonObject(text) {
    if (!text) return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return text.slice(start, end + 1);
}

function buildFallbackInterpretation(query) {
    const normalizedQuery = String(query || '').trim();
    const compactQuery = normalizedQuery.replace(/\s+/g, ' ');
    const searchTerms = compactQuery ? [compactQuery] : [];
    const isRomanian = /[ăâîșşțţ]|\b(cu|si|și|pentru|telefon|laptop|pret|preț)\b/i.test(compactQuery);

    return {
        searchTerms,
        intent: compactQuery,
        language: isRomanian ? 'ro' : 'en',
        fallback: true
    };
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function isLikelyAccessory(query, title) {
    const normalizedTitle = normalizeText(title);
    const normalizedQuery = normalizeText(query);

    if (!normalizedTitle || !normalizedQuery) return false;

    const accessoryKeywords = [
        'husa', 'huse', 'case', 'cover', 'wallet', 'folio', 'bumper',
        'sticla', 'sticla de protectie', 'tempered glass', 'glass',
        'screen protector', 'protector', 'privacy glass',
        'cablu', 'cable', 'charger', 'incarcator', 'adapter',
        'earbuds', 'headphones', 'casti', 'headset',
        'holder', 'stand', 'mount', 'dock',
        'battery', 'power bank', 'stylus', 'pen',
        'skin', 'film', 'lens protector', 'ring', 'strap'
    ];

    const queryTokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 1);
    const titleContainsQuerySignal = queryTokens.some((token) => normalizedTitle.includes(token));
    const hasAccessoryKeyword = accessoryKeywords.some((keyword) => normalizedTitle.includes(keyword));

    return titleContainsQuerySignal && hasAccessoryKeyword;
}

async function interpretQueryWithAi(query) {
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
    const fallback = buildFallbackInterpretation(query);

    const systemPrompt =
        'You interpret ecommerce search queries. ' +
        'Return ONLY valid JSON with this shape: ' +
        '{"searchTerms":["..."],"intent":"...","language":"ro|en","fallback":false}. ' +
        'Keep searchTerms short, practical, and focused on the main product.';

    const userPrompt =
        `User query: "${query}"\n` +
        'Infer the main buying intent, normalize the search terms, and detect language. ' +
        'Return JSON only.';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                stream: false,
                options: { temperature: 0.1 },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return fallback;
        }

        const payload = await response.json();
        const content = payload?.message?.content || '';
        const jsonText = extractFirstJsonObject(content);

        if (!jsonText) {
            return fallback;
        }

        const parsed = JSON.parse(jsonText);
        const parsedSearchTerms = Array.isArray(parsed?.searchTerms)
            ? parsed.searchTerms.map((term) => String(term || '').trim()).filter(Boolean)
            : [];

        return {
            searchTerms: parsedSearchTerms.length > 0 ? parsedSearchTerms.slice(0, 3) : fallback.searchTerms,
            intent: String(parsed?.intent || fallback.intent).trim() || fallback.intent,
            language: parsed?.language === 'ro' ? 'ro' : fallback.language,
            fallback: false
        };
    } catch (error) {
        console.warn(`⚠️ interpretQueryWithAi fallback: ${error.message}`);
        return fallback;
    }
}

async function aiFilterProducts(query, products) {
    if (!Array.isArray(products) || products.length === 0) return products;

    const heuristicFiltered = products.filter((product) => !isLikelyAccessory(query, product.title));
    const candidateProducts = heuristicFiltered.length > 0 ? heuristicFiltered : products;

    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

    // Trimitem în batch-uri de 40 ca să nu depășim contextul modelului
    const BATCH_SIZE = 40;
    const relevantIds = new Set();

    for (let i = 0; i < candidateProducts.length; i += BATCH_SIZE) {
        const batch = candidateProducts.slice(i, i + BATCH_SIZE);
        const candidates = batch.map((p) => ({ id: p.id, title: p.title }));

        const systemPrompt =
            'You are a strict product filter assistant. ' +
            'You receive a user search query and a list of product titles. ' +
            'Your task: return ONLY the IDs of products that ARE the exact searched item. ' +
            'EXCLUDE everything that is an accessory, case, cover, charger, cable, screen protector, earphone, holder, stand, adapter, battery, or any peripheral for the product. ' +
            'Return ONLY valid JSON, no explanation, no markdown.';

        const userPrompt =
            `User searched for: "${query}"\n\n` +
            `Products:\n${JSON.stringify(candidates)}\n\n` +
            `Return only IDs of products that ARE the actual "${query}" device/product itself, NOT accessories.\n` +
            `JSON format: {"relevant": ["id1", "id2"]}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            const response = await fetch(`${OLLAMA_URL}/api/chat`, {
                method: 'POST',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    stream: false,
                    options: { temperature: 0.0 },
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ]
                })
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`⚠️  Ollama batch ${i}-${i + BATCH_SIZE} skipped: HTTP ${response.status}`);
                // Dacă Ollama nu e disponibil, returnăm produsele nemodificate
                batch.forEach((p) => relevantIds.add(p.id));
                continue;
            }

            const payload = await response.json();
            const content = payload?.message?.content || '';
            console.log(`🤖 Ollama răspuns batch ${Math.floor(i / BATCH_SIZE) + 1}:`, content.slice(0, 300));

            const jsonText = extractFirstJsonObject(content);
            if (!jsonText) {
                console.warn('⚠️  Ollama nu a returnat JSON valid, păstrăm batch-ul nefiltrat');
                batch.forEach((p) => relevantIds.add(p.id));
                continue;
            }

            const parsed = JSON.parse(jsonText);
            const batchRelevant = Array.isArray(parsed?.relevant) ? parsed.relevant : [];

            if (batchRelevant.length === 0) {
                console.log(`ℹ️  Ollama: niciun produs relevant în batch-ul ${Math.floor(i / BATCH_SIZE) + 1}`);
            } else {
                batchRelevant.forEach((id) => relevantIds.add(id));
            }
        } catch (error) {
            console.warn(`⚠️  Ollama batch ${i} error: ${error.message} — batch păstrat nefiltrat`);
            batch.forEach((p) => relevantIds.add(p.id));
        }
    }

    const filtered = candidateProducts.filter((p) => relevantIds.has(p.id));
    console.log(`🤖 Ollama filtru: ${products.length} → ${candidateProducts.length} → ${filtered.length} produse relevante`);
    return filtered.length > 0 ? filtered : candidateProducts;
}

async function filterProductsWithGemini(query, products) {
    if (!Array.isArray(products) || products.length === 0) return products;

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const heuristicFiltered = products.filter((product) => !isLikelyAccessory(query, product.title));
    const candidateProducts = heuristicFiltered.length > 0 ? heuristicFiltered : products;

    if (!apiKey) {
        console.warn('⚠️ GEMINI_API_KEY missing, using heuristic filter only');
        return candidateProducts;
    }

    const BATCH_SIZE = 60;
    const relevantIds = new Set();

    for (let i = 0; i < candidateProducts.length; i += BATCH_SIZE) {
        const batch = candidateProducts.slice(i, i + BATCH_SIZE);
        const candidates = batch.map((product) => ({
            id: product.id,
            title: product.title,
            store: product.store,
            price: product.price
        }));

        const prompt =
            'You are filtering ecommerce search results for a price comparison app.\n' +
            `User query: "${query}"\n\n` +
            'Return ONLY valid JSON with this exact shape: {"relevant":["id1","id2"]}.\n' +
            'Keep products that are the actual searched product or very close variants.\n' +
            'Exclude accessories and peripheral items, including cases, covers, protective glass, screen protectors, chargers, cables, adapters, holders, stands, straps, skins, lens protectors, and similar add-ons.\n' +
            'For phone searches, keep actual phones even if storage/color differs. Do not keep products whose title says case, husa, husă, чехол, стекло, sticla, glass, protector, cable, charger, adapter.\n\n' +
            `Products:\n${JSON.stringify(candidates)}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
                {
                    method: 'POST',
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: 'user',
                                parts: [{ text: prompt }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0,
                            responseMimeType: 'application/json'
                        }
                    })
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`⚠️ Gemini batch ${i}-${i + BATCH_SIZE} skipped: HTTP ${response.status}`);
                batch.forEach((product) => relevantIds.add(product.id));
                continue;
            }

            const payload = await response.json();
            const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const jsonText = extractFirstJsonObject(content);
            if (!jsonText) {
                console.warn('⚠️ Gemini did not return valid JSON, keeping batch');
                batch.forEach((product) => relevantIds.add(product.id));
                continue;
            }

            const parsed = JSON.parse(jsonText);
            const batchRelevant = Array.isArray(parsed?.relevant) ? parsed.relevant : [];
            batchRelevant.forEach((id) => relevantIds.add(String(id)));
        } catch (error) {
            console.warn(`⚠️ Gemini batch ${i} error: ${error.message}, keeping batch`);
            batch.forEach((product) => relevantIds.add(product.id));
        }
    }

    const filtered = candidateProducts.filter((product) => relevantIds.has(product.id));
    const minimumUsefulResults = Math.min(12, Math.ceil(candidateProducts.length * 0.2));

    if (filtered.length < minimumUsefulResults && candidateProducts.length > minimumUsefulResults) {
        console.warn(`⚠️ Gemini filter too aggressive (${candidateProducts.length} → ${filtered.length}), using heuristic output`);
        return candidateProducts;
    }

    console.log(`🤖 Gemini filter: ${products.length} → ${candidateProducts.length} → ${filtered.length}`);
    return filtered.length > 0 ? filtered : candidateProducts;
}

// Funcție helper pentru delay între request-uri
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Configurație selectori pentru fiecare magazin
const storeConfigs = {
    darwin: {
        name: 'Darwin.md',
        icon: '🦎',
        // TEMPORARY: folosim pagina de categorie în loc de search (Livewire issues)
        searchUrl: (query) => {
            // Pentru iPhone/Apple căutări, folosește categoria Apple
            if (query.toLowerCase().includes('iphone') || query.toLowerCase().includes('apple')) {
                return `https://darwin.md/telefoane/smartphone/apple-iphone`;
            }
            // Pentru alte căutări, încearcă search-ul normal
            return `https://darwin.md/ro/search?q=${encodeURIComponent(query)}`;
        },
        selectors: {
            productCard: '.product-card',
            title: '.title-product',
            price: '.price-new',
            image: 'img',
            link: 'a.product-link'
        }
    },
    cactus: {
        name: 'Cactus.md',
        icon: '🌵',
        searchUrl: (query) => `https://www.cactus.md/ro/search/?q=${encodeURIComponent(query)}`,
        selectors: {
            productCard: '.catalog__pill',
            title: '.catalog__pill__text__title',
            price: '.catalog__pill__controls__price',
            image: '.catalog__pill__img__prime',
            link: 'a'
        }
    },
    bomba: {
        name: 'Bomba.md',
        icon: '💣',
        searchUrl: (query) => `https://bomba.md/ru/poisk/?query=${encodeURIComponent(query)}`,
        selectors: {
            productCard: '.product__item',
            title: 'a.name',
            price: '.product-price .price',
            image: '.product__photo img',
            link: 'a.name'
        }
    },
    ultra: {
        name: 'Ultra.md',
        icon: '⚡',
        searchUrl: (query) => `https://ultra.md/search?search=${encodeURIComponent(query)}`,
        selectors: {
            productCard: '.product-card',
            title: '.product-card__title',
            price: '.product-card__current-price',
            image: '.product-card__image',
            link: 'a.product-card__link'
        }
    },
    panda: {
        name: 'PandaShop.md',
        icon: '🐼',
        searchUrl: (query) => `https://pandashop.md/ro/search/?text=${encodeURIComponent(query)}`,
        selectors: {
            productCard: '.js-itemsList.cardsList .card.js-itemsList-item',
            title: '.card-title .lnk-txt, [itemprop="name"]',
            price: '.card-price_curr, meta[itemprop="price"]',
            image: 'meta[itemprop="image"], picture source[srcset], img[itemprop="image"], img',
            link: 'a.card-title, a[href*="/product/"]',
            availability: 'link[itemprop="availability"]'
        }
    }
};

// Funcție de scraping pentru un magazin specific
async function scrapeStore(browser, storeName, query, config) {
    const page = await browser.newPage();
    
    try {
        console.log(`🔍 Scraping ${config.name} pentru: ${query}`);
        
        // Setează user agent pentru a părea browser normal
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Navighează la pagina de căutare
        const searchUrl = config.searchUrl(query);
        console.log(`📡 URL: ${searchUrl}`);
        await page.goto(searchUrl, { 
            waitUntil: 'networkidle2',
            timeout: 60000  // Măresc la 60s
        });
        
        // Așteaptă ca produsele să se încarce (JavaScript dinamic)
        try {
            await page.waitForSelector(config.selectors.productCard, { timeout: 15000 });
            console.log(`✅ Selectorul ${config.selectors.productCard} găsit!`);
        } catch (e) {
            console.log(`⚠️ Nu s-au găsit produse cu selectorul ${config.selectors.productCard}`);
        }
        
        // Delay suplimentar pentru siguranta
        await delay(2000);
        
        // SCROLL AUTOMAT pentru a încărca toate produsele (scroll infinit)
        console.log(`📜 Încep scroll automat pentru a încărca toate produsele...`);
        let previousHeight = 0;
        let scrollAttempts = 0;
        const maxScrolls = 10; // Maxim 10 scroll-uri pentru a nu aștepta prea mult
        
        while (scrollAttempts < maxScrolls) {
            // Scroll la sfârșitul paginii
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await delay(1500); // Așteaptă încărcarea
            
            // Verifică dacă s-au încărcat mai multe produse
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            const productCount = await page.evaluate((selector) => 
                document.querySelectorAll(selector).length, 
                config.selectors.productCard
            );
            
            console.log(`  Scroll ${scrollAttempts + 1}: ${productCount} produse găsite`);
            
            // Dacă înălțimea nu s-a schimbat, nu mai sunt produse
            if (currentHeight === previousHeight) {
                console.log(`✅ Nu mai sunt produse de încărcat`);
                break;
            }
            
            previousHeight = currentHeight;
            scrollAttempts++;
        }
        
        // Scroll înapoi sus
        await page.evaluate(() => window.scrollTo(0, 0));
        await delay(500);
        
        // Extrage produsele
        const products = await page.evaluate((selectors, storeName, storeIcon, storeUrl) => {
            const productCards = document.querySelectorAll(selectors.productCard);
            console.log(`🔍 Găsite ${productCards.length} carduri cu selectorul: ${selectors.productCard}`);
            const results = [];
            
            productCards.forEach((card, index) => {
                try {
                    // Extrage titlul
                    const titleEl = card.querySelector(selectors.title);
                    const title = titleEl
                        ? ((titleEl.getAttribute && titleEl.getAttribute('content')) || titleEl.textContent || '').trim()
                        : null;
                    
                    console.log(`  Card ${index}: title="${title}"`);
                    
                    if (!title || title.length < 3) return; // Skip dacă nu e titlu valid
                    
                    // Extrage prețul
                    const priceEl = card.querySelector(selectors.price);
                    let price = 0;
                    let priceText = '';
                    if (priceEl) {
                        priceText = (
                            (priceEl.getAttribute && priceEl.getAttribute('content')) ||
                            priceEl.textContent ||
                            ''
                        ).trim();
                    }
                    if (!priceText) {
                        priceText = (card.textContent || '').trim();
                    }
                    const priceMatch = priceText.match(/(\d[\d\s.,]{2,})/);
                    if (priceMatch) {
                        price = parseFloat(priceMatch[1].replace(/[^\d]/g, ''));
                    }
                    
                    // Extrage imaginea
                    const imgEl = card.querySelector(selectors.image);
                    let image = '/api/placeholder/200/200';
                    if (imgEl) {
                        const srcset = imgEl.getAttribute && imgEl.getAttribute('srcset');
                        const firstSrcFromSet = srcset ? srcset.split(',')[0].trim().split(' ')[0] : '';
                        image =
                            (imgEl.getAttribute && imgEl.getAttribute('content')) ||
                            firstSrcFromSet ||
                            imgEl.src ||
                            (imgEl.getAttribute && imgEl.getAttribute('data-src')) ||
                            (imgEl.getAttribute && imgEl.getAttribute('data-lazy-src')) ||
                            image;
                        // Normalizează URL-ul imaginii
                        if (image.startsWith('//')) {
                            image = 'https:' + image;
                        } else if (image.startsWith('/')) {
                            image = window.location.origin + image;
                        }
                    }
                    
                    // Extrage link-ul către produs
                    const linkEl = card.querySelector(selectors.link) || card.closest('a');
                    let productUrl = storeUrl;
                    if (linkEl) {
                        productUrl = linkEl.href || linkEl.getAttribute('href') || storeUrl;
                        // Normalizează URL-ul
                        if (productUrl.startsWith('//')) {
                            productUrl = 'https:' + productUrl;
                        } else if (productUrl.startsWith('/')) {
                            productUrl = window.location.origin + productUrl;
                        }
                    }
                    
                    const availabilityEl = selectors.availability
                        ? card.querySelector(selectors.availability)
                        : null;
                    const availabilityHref = availabilityEl
                        ? (availabilityEl.getAttribute('href') || '')
                        : '';
                    const stockText = (card.textContent || '').toLowerCase();
                    const explicitOutOfStock =
                        availabilityHref.includes('OutOfStock') ||
                        stockText.includes('indisponibil') ||
                        stockText.includes('stoc epuizat') ||
                        stockText.includes('out of stock');
                    const inStock = availabilityHref
                        ? availabilityHref.includes('InStock')
                        : !explicitOutOfStock;

                    results.push({
                        id: `${storeName}_${Date.now()}_${index}`,
                        title: title,
                        price: price,
                        image: image,
                        productUrl: productUrl,
                        store: storeName,
                        storeIcon: storeIcon,
                        storeUrl: storeUrl,
                        description: title,
                        rating: 4 + Math.random(), // Random rating între 4-5
                        reviewCount: Math.floor(Math.random() * 100) + 10,
                        reviews: [],
                        availability: inStock ? 'În stoc' : 'Indisponibil',
                        inStock: inStock  // Pentru filtrul frontend
                    });
                } catch (err) {
                    console.error('Error parsing product card:', err);
                }
            });
            
            return results;
        }, config.selectors, config.name, config.icon, config.searchUrl(query).split('?')[0]);
        
        console.log(`✅ ${config.name}: ${products.length} produse găsite`);
        
        await page.close();
        return products;
        
    } catch (error) {
        console.error(`❌ Error scraping ${config.name}:`, error.message);
        await page.close();
        return [];
    }
}

// Endpoint principal de căutare
app.post('/interpret-query', async (req, res) => {
    const query = String(req.body?.query || '').trim();

    if (!query) {
        return res.status(400).json({ error: 'Body field "query" is required' });
    }

    const interpretation = await interpretQueryWithAi(query);
    res.json(interpretation);
});

app.post('/filter-products', async (req, res) => {
    const query = String(req.body?.query || '').trim();
    const products = Array.isArray(req.body?.products) ? req.body.products : [];

    if (!query) {
        return res.status(400).json({ error: 'Body field "query" is required' });
    }

    if (products.length === 0) {
        return res.json([]);
    }

    try {
        const filteredProducts = await filterProductsWithGemini(query, products);
        res.json(filteredProducts);
    } catch (error) {
        console.error('Gemini filter endpoint error:', error.message);
        res.json(products.filter((product) => !isLikelyAccessory(query, product.title)));
    }
});

app.get('/search', async (req, res) => {
    const query = req.query.q;
    const useAiRerank = String(req.query.ai || '').trim() === '1';
    
    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    console.log(`\n🔎 Căutare nouă: "${query}"`);
    
    // Verifică cache
    const cacheKey = `search_${query.toLowerCase()}_ai_${useAiRerank ? '1' : '0'}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        console.log('📦 Returnat din cache');
        return res.json(cached);
    }
    
    let browser;
    try {
        // Lansează browser Puppeteer
        console.log('🌐 Lansez Puppeteer browser...');
        const fs = require('fs');
        const possibleChromePaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
        ];
        const systemChrome = possibleChromePaths.find(p => fs.existsSync(p));

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: systemChrome || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
        console.log('✅ Puppeteer browser lansat cu succes!');
        
        // Scrape toate magazinele în paralel
        const scrapePromises = Object.entries(storeConfigs).map(([storeName, config]) => 
            scrapeStore(browser, config.name, query, config)
                .catch(err => {
                    console.error(`Error in ${storeName}:`, err);
                    return [];
                })
        );
        
        const results = await Promise.all(scrapePromises);
        
        // Combină toate rezultatele
        const allProducts = results.flat();
        console.log(`\n📦 Total produse scraped: ${allProducts.length}`);

        let finalProducts;
        if (useAiRerank) {
            const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
            const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2:3b';
            console.log(`🤖 Filtru AI Ollama activ (${ollamaModel} @ ${ollamaUrl})...`);
            finalProducts = await aiFilterProducts(query, allProducts);
        } else {
            finalProducts = allProducts;
        }

        console.log(`✨ Total final: ${finalProducts.length} produse returnate`);
        
        // Salvează în cache
        cache.set(cacheKey, finalProducts);
        
        await browser.close();
        res.json(finalProducts);
        
    } catch (error) {
        console.error('❌ Server error:', error);
        if (browser) await browser.close();
        res.status(500).json({ 
            error: 'Failed to scrape products',
            message: error.message 
        });
    }
});

app.get('/image-proxy', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();

    if (!rawUrl) {
        return res.status(400).json({ error: 'Query parameter "url" is required' });
    }

    let targetUrl;
    try {
        targetUrl = new URL(rawUrl);
    } catch (error) {
        return res.status(400).json({ error: 'Invalid image URL' });
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        return res.status(400).json({ error: 'Only http/https URLs are allowed' });
    }

    if (!isAllowedImageHost(targetUrl.hostname)) {
        return res.status(403).json({ error: 'Image host is not allowed' });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const upstream = await fetch(targetUrl.toString(), {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': `${targetUrl.protocol}//${targetUrl.hostname}/`
            }
        });

        clearTimeout(timeoutId);

        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: `Upstream image request failed with ${upstream.status}` });
        }

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        const cacheHeader = upstream.headers.get('cache-control') || 'public, max-age=3600';
        const buffer = Buffer.from(await upstream.arrayBuffer());

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', cacheHeader);
        res.send(buffer);
    } catch (error) {
        console.error('Image proxy error:', error.message);
        res.status(502).json({ error: 'Failed to fetch image from source' });
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'PulsePrice API',
        endpoints: ['/health', '/search?q=iphone', '/search?q=iphone&ai=1']
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'PulsePrice Scraper Server is running!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 PulsePrice Scraper Server pornit pe http://localhost:${PORT}`);
    console.log(`📝 Test: http://localhost:${PORT}/search?q=iPhone`);
    console.log(`💚 Health: http://localhost:${PORT}/health\n`);
});
