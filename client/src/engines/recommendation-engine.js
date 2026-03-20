// Recommendation engine with stronger relevance filtering.
export class RecommendationEngine {
    constructor(nlpEngine) {
        this.nlpEngine = nlpEngine;
        this.weights = {
            price: 0.25,
            rating: 0.30,
            reviews: 0.15,
            availability: 0.10,
            relevance: 0.20
        };
        this.categoryKeywords = {
            phone: [
                'telefon', 'smartphone', 'iphone', 'galaxy', 'redmi', 'pixel', 'phone', 'mobil',
                'телефон', 'смартфон', 'mobile phone'
            ],
            laptop: ['laptop', 'notebook', 'ultrabook', 'macbook'],
            tablet: ['tableta', 'tablet', 'ipad'],
            tv: ['televizor', 'tv', 'qled', 'oled', 'smart tv', 'телевизор'],
            audio: ['casti', 'headphones', 'earbuds', 'boxa', 'speaker', 'soundbar'],
            appliance: [
                'cuptor', 'plita', 'aragaz', 'frigider', 'masina de spalat', 'boiler', 'hota', 'microunde',
                'вытяжка', 'панель', 'духовой', 'холодильник', 'плита'
            ]
        };
    }

    normalizePriceScore(price, minPrice, maxPrice) {
        if (!Number.isFinite(price)) return 0;
        if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || maxPrice === minPrice) {
            return 100;
        }

        return ((maxPrice - price) / (maxPrice - minPrice)) * 100;
    }

    normalizeRatingScore(rating, reviewCount) {
        const safeRating = Number.isFinite(Number(rating)) ? Number(rating) : 0;
        const safeReviewCount = Number.isFinite(Number(reviewCount)) ? Number(reviewCount) : 0;
        const ratingScore = (safeRating / 5) * 100;
        const reviewConfidence = Math.min(safeReviewCount / 100, 1);

        return ratingScore * (0.7 + reviewConfidence * 0.3);
    }

    availabilityScore(inStock) {
        return inStock ? 100 : 0;
    }

    getReviewCount(product) {
        const raw = product.reviewCount ?? product.reviews ?? 0;
        const normalized = Number(raw);
        return Number.isFinite(normalized) ? normalized : 0;
    }

    calculateProductScore(product, searchQuery, priceRange) {
        const { minPrice, maxPrice } = priceRange;
        const price = Number.isFinite(Number(product.price)) ? Number(product.price) : 0;
        const rating = Number.isFinite(Number(product.rating)) ? Number(product.rating) : 0;
        const reviewCount = this.getReviewCount(product);

        const priceScore = this.normalizePriceScore(price, minPrice, maxPrice);
        const ratingScore = this.normalizeRatingScore(rating, reviewCount);
        const availScore = this.availabilityScore(product.inStock);

        const nlpAnalysis = this.nlpEngine.analyzeProduct(product, searchQuery);
        const relevanceScore = Number.isFinite(Number(nlpAnalysis.relevanceScore))
            ? Number(nlpAnalysis.relevanceScore)
            : 0;

        let sentimentBonus = 0;
        if (nlpAnalysis.sentiment.label === 'positive') {
            sentimentBonus = nlpAnalysis.sentiment.confidence * 0.1;
        }

        const reviewScore = Math.min((reviewCount / 500) * 100, 100);

        const finalScore = (
            priceScore * this.weights.price +
            ratingScore * this.weights.rating +
            reviewScore * this.weights.reviews +
            availScore * this.weights.availability +
            relevanceScore * this.weights.relevance +
            sentimentBonus
        );

        return {
            finalScore: Math.round(Number.isFinite(finalScore) ? finalScore : 0),
            breakdown: {
                price: Math.round(priceScore),
                rating: Math.round(ratingScore),
                reviews: Math.round(reviewScore),
                availability: Math.round(availScore),
                relevance: Math.round(relevanceScore),
                sentiment: nlpAnalysis.sentiment
            },
            nlpAnalysis
        };
    }

    extractNumbers(text) {
        const matches = String(text || '').match(/\d+/g);
        return matches ? matches.map(n => parseInt(n, 10)) : [];
    }

    extractQueryTokens(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
            .split(/\s+/)
            .map(token => token.trim())
            .filter(token => token.length >= 2);
    }

    extractModelCodes(text) {
        return this.extractQueryTokens(text)
            // Accept short model codes too: s23, a55, m14, x6, etc.
            .filter(token => /[a-z]/i.test(token) && /\d/.test(token) && token.length >= 2);
    }

    compactText(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    titleContainsModelCode(productTitle, modelCode) {
        const compactTitle = this.compactText(productTitle);
        const compactCode = this.compactText(modelCode);
        return compactCode.length > 0 && compactTitle.includes(compactCode);
    }

    detectQueryCategories(searchQuery) {
        const query = String(searchQuery || '').toLowerCase();
        const detected = new Set();

        Object.entries(this.categoryKeywords).forEach(([category, keywords]) => {
            if (keywords.some(keyword => query.includes(keyword))) {
                detected.add(category);
            }
        });

        // Heuristic: Samsung short model codes are usually phones (S23, A55, M14, etc.).
        const hasSamsung = query.includes('samsung');
        const modelCodes = this.extractModelCodes(searchQuery);
        const looksLikeSamsungPhoneModel = modelCodes.some(code => /^[asfmx]\d{1,3}$/i.test(code));
        if (hasSamsung && looksLikeSamsungPhoneModel) {
            detected.add('phone');
        }

        return detected;
    }

    productCategoriesFromTitle(productTitle) {
        const title = String(productTitle || '').toLowerCase();
        const categories = new Set();

        Object.entries(this.categoryKeywords).forEach(([category, keywords]) => {
            if (keywords.some(keyword => title.includes(keyword))) {
                categories.add(category);
            }
        });

        return categories;
    }

    matchesQueryCategory(productTitle, searchQuery) {
        const queryCategories = this.detectQueryCategories(searchQuery);
        if (queryCategories.size === 0) return true;

        const productCategories = this.productCategoriesFromTitle(productTitle);
        if (productCategories.size === 0) return false;

        return Array.from(queryCategories).some(category => productCategories.has(category));
    }

    isAccessory(productTitle) {
        const accessoryKeywords = [
            'husa', 'huse', 'case',
            'folie', 'folii', 'sticla', 'protectie', 'glass',
            'cablu', 'cabluri', 'cable', 'incarcator', 'charger',
            'adaptor', 'adapter',
            'casti', 'headphones', 'earphones', 'airpods',
            'suport', 'holder', 'stand',
            'baterie externa', 'powerbank', 'power bank',
            'stylus', 'pen',
            'card memorie', 'sd card', 'micro sd',
            'sim card',
            'cleaner', 'curatare',
            'chehol', 'steklo', 'zaryadnoe'
        ];

        const lowerTitle = String(productTitle || '').toLowerCase().normalize('NFKD');
        return accessoryKeywords.some(keyword => lowerTitle.includes(keyword));
    }

    matchesModelNumber(productTitle, searchQuery) {
        const queryNumbers = this.extractNumbers(searchQuery);
        const titleNumbers = this.extractNumbers(productTitle);

        if (queryNumbers.length === 0) {
            return true;
        }

        if (queryNumbers.length === 1 && queryNumbers[0] <= 20) {
            return titleNumbers.includes(queryNumbers[0]);
        }

        const mainQueryNumbers = queryNumbers.filter(n => n <= 20);
        if (mainQueryNumbers.length === 0) {
            return true;
        }

        return mainQueryNumbers.some(queryNum => titleNumbers.includes(queryNum));
    }

    isRelevantToQuery(productTitle, searchQuery) {
        const title = String(productTitle || '').toLowerCase();
        const queryTokens = this.extractQueryTokens(searchQuery);

        if (queryTokens.length === 0) {
            return true;
        }

        const stopWords = new Set([
            'de', 'cu', 'si', 'și', 'pentru', 'la', 'din', 'pe', 'in', 'în',
            'the', 'and', 'for', 'pro', 'max', 'mini', 'plus'
        ]);

        const modelCodes = this.extractModelCodes(searchQuery);
        if (modelCodes.length > 0) {
            return modelCodes.some(code => this.titleContainsModelCode(title, code));
        }

        const meaningfulTokens = queryTokens.filter(token => !stopWords.has(token));
        if (meaningfulTokens.length === 0) {
            return true;
        }

        const textTokens = meaningfulTokens.filter(token => !/^\d+$/.test(token));
        const numberTokens = meaningfulTokens.filter(token => /^\d+$/.test(token));

        const textMatchedCount = textTokens.filter(token => title.includes(token)).length;
        const matchedCount = meaningfulTokens.filter(token => title.includes(token)).length;

        if (textTokens.length > 0 && textMatchedCount === 0) {
            return false;
        }

        const requiredMatches = textTokens.length > 1
            ? Math.max(2, Math.floor(textTokens.length * 0.6))
            : (textTokens.length === 1 ? 1 : Math.max(1, Math.floor(meaningfulTokens.length * 0.5)));

        if (matchedCount < requiredMatches) {
            return false;
        }

        const storageSizes = new Set(['32', '64', '128', '256', '512', '1024', '2048']);
        const storageInQuery = numberTokens.filter(token => storageSizes.has(token));
        if (storageInQuery.length > 0) {
            const hasStorageMatch = storageInQuery.some(size => new RegExp(`\\b${size}\\s?(gb|гб)?\\b`, 'i').test(title));
            if (!hasStorageMatch) {
                return false;
            }
        }

        return true;
    }

    passesBasicFilters(product, filters = {}) {
        if (filters.maxPrice && Number(product.price) > filters.maxPrice) {
            return false;
        }

        if (filters.minRating && Number(product.rating || 0) < filters.minRating) {
            return false;
        }

        if (filters.inStock && !product.inStock) {
            return false;
        }

        return true;
    }

    isRelaxedRelevant(productTitle, searchQuery) {
        const title = String(productTitle || '').toLowerCase();
        const tokens = this.extractQueryTokens(searchQuery);
        if (tokens.length === 0) return true;

        const modelCodes = this.extractModelCodes(searchQuery);
        if (modelCodes.length > 0) {
            // For model searches, relaxed mode should still preserve model intent.
            return modelCodes.some(code => this.titleContainsModelCode(title, code));
        }

        const meaningfulTokens = tokens.filter(token => token.length >= 2);
        if (meaningfulTokens.length === 0) return true;

        const textTokens = meaningfulTokens.filter(token => !/^\d+$/.test(token));
        if (textTokens.length > 0) {
            return textTokens.some(token => title.includes(token));
        }

        // Relaxed mode: at least one meaningful token should match.
        return meaningfulTokens.some(token => title.includes(token));
    }

    recommendProducts(products, searchQuery, filters = {}) {
        if (!products || products.length === 0) {
            return [];
        }

        const strictFilteredProducts = products.filter(product => {
            if (!this.matchesQueryCategory(product.title, searchQuery)) {
                return false;
            }

            if (!this.isRelevantToQuery(product.title, searchQuery)) {
                return false;
            }

            if (this.isAccessory(product.title)) {
                return false;
            }

            if (!this.matchesModelNumber(product.title, searchQuery)) {
                return false;
            }

            return this.passesBasicFilters(product, filters);
        });

        let filteredProducts = strictFilteredProducts.length > 0
            ? strictFilteredProducts
            : products.filter(product => {
                if (!this.matchesQueryCategory(product.title, searchQuery)) {
                    return false;
                }

                if (this.isAccessory(product.title)) {
                    return false;
                }

                if (!this.isRelaxedRelevant(product.title, searchQuery)) {
                    return false;
                }

                return this.passesBasicFilters(product, filters);
            });

        // Last-resort fallback:
        // if strict+relaxed filtering found nothing, still return model-matching
        // products (often accessories) instead of empty state.
        if (filteredProducts.length === 0) {
            const modelCodes = this.extractModelCodes(searchQuery);
            if (modelCodes.length > 0) {
                filteredProducts = products.filter(product => {
                    if (!this.passesBasicFilters(product, filters)) {
                        return false;
                    }

                    const title = String(product.title || '');
                    return modelCodes.some(code => this.titleContainsModelCode(title, code));
                });
            }
        }

        if (filteredProducts.length === 0) {
            return [];
        }

        const prices = filteredProducts
            .map(product => Number(product.price))
            .filter(price => Number.isFinite(price));

        const priceRange = {
            minPrice: prices.length ? Math.min(...prices) : 0,
            maxPrice: prices.length ? Math.max(...prices) : 0
        };

        const scoredProducts = filteredProducts.map(product => {
            const scoreData = this.calculateProductScore(product, searchQuery, priceRange);
            return {
                ...product,
                recommendationScore: scoreData.finalScore,
                scoreBreakdown: scoreData.breakdown,
                nlpData: scoreData.nlpAnalysis,
                reviewCount: this.getReviewCount(product)
            };
        });

        return this.sortProducts(scoredProducts, filters.sortBy || 'score');
    }

    sortProducts(products, sortBy) {
        const sorted = [...products];

        switch (sortBy) {
            case 'price-asc':
                return sorted.sort((a, b) => a.price - b.price);

            case 'price-desc':
                return sorted.sort((a, b) => b.price - a.price);

            case 'rating':
                return sorted.sort((a, b) => {
                    if (b.rating === a.rating) {
                        return this.getReviewCount(b) - this.getReviewCount(a);
                    }
                    return b.rating - a.rating;
                });

            case 'score':
            default:
                return sorted.sort((a, b) => b.recommendationScore - a.recommendationScore);
        }
    }

    generateExplanation(product) {
        const reasons = [];

        if (product.recommendationScore >= 80) {
            reasons.push('Cel mai bun raport calitate-pret');
        }

        if (product.scoreBreakdown.rating >= 85) {
            reasons.push(`Rating excelent (${product.rating} stele)`);
        }

        if (this.getReviewCount(product) > 100) {
            reasons.push(`${this.getReviewCount(product)} recenzii verificate`);
        }

        if (product.nlpData.sentiment.label === 'positive') {
            reasons.push('Recenzii predominant pozitive');
        }

        if (product.scoreBreakdown.price >= 70) {
            reasons.push('Pret competitiv');
        }

        if (Object.keys(product.nlpData.features).length >= 3) {
            reasons.push('Caracteristici complete');
        }

        return reasons.length > 0 ? reasons : ['Produs recomandat'];
    }

    findSimilarProducts(targetProduct, allProducts, limit = 3) {
        const similarities = allProducts
            .filter(product => product.id !== targetProduct.id)
            .map(product => {
                const titleSim = this.nlpEngine.calculateSimilarity(targetProduct.title, product.title);
                const priceSim = 1 - Math.abs(targetProduct.price - product.price) /
                    Math.max(targetProduct.price, product.price);

                return {
                    product,
                    similarity: (titleSim * 0.7 + priceSim * 0.3)
                };
            })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        return similarities.map(item => item.product);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecommendationEngine;
}
