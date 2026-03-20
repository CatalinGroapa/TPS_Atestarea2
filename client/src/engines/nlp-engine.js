// NLP Engine pentru analiza și procesarea textului
class NLPEngine {
    constructor() {
        this.stopWords = new Set([
            'si', 'și', 'de', 'la', 'in', 'în', 'cu', 'pe', 'pentru', 'cel', 'cea', 'mai',
            'un', 'o', 'sau', 'dar', 'ca', 'că', 'este', 'sunt', 'foarte', 'din', 'care'
        ]);

        this.sentimentKeywords = {
            positive: ['excelent', 'bun', 'foarte bun', 'perfect', 'recomandat', 'calitate', 
                      'performant', 'rapid', 'rezistent', 'eficient', 'minunat', 'super',
                      'excellent', 'good', 'great', 'amazing', 'recommended', 'quality'],
            negative: ['slab', 'prost', 'defect', 'problema', 'probleme', 'dezamăgit', 
                      'scump', 'ieftin', 'spart', 'stricat', 'rău', 'bad', 'poor',
                      'terrible', 'broken', 'disappointing', 'expensive']
        };

        this.featureKeywords = {
            performance: ['rapid', 'performant', 'viteza', 'putere', 'procesor', 'ram', 'ghz', 'performance', 'fast', 'speed'],
            quality: ['calitate', 'rezistent', 'durabil', 'premium', 'solid', 'quality', 'durable', 'premium'],
            design: ['design', 'aspect', 'elegant', 'modern', 'frumos', 'beautiful', 'elegant', 'modern'],
            price: ['pret', 'preț', 'valoare', 'ieftin', 'scump', 'cost', 'price', 'value', 'cheap', 'expensive'],
            battery: ['baterie', 'autonomie', 'durata', 'battery', 'life', 'charging'],
            screen: ['ecran', 'display', 'rezolutie', 'rezoluție', 'screen', 'display', 'resolution']
        };
    }

    // Tokenizare și curățare text
    tokenize(text) {
        if (!text) return [];
        
        return text
            .toLowerCase()
            .replace(/[^\w\săâîșț]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !this.stopWords.has(word));
    }

    // Extrage cuvinte cheie din text
    extractKeywords(text, maxKeywords = 10) {
        const tokens = this.tokenize(text);
        const frequency = {};

        tokens.forEach(token => {
            frequency[token] = (frequency[token] || 0) + 1;
        });

        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxKeywords)
            .map(([word]) => word);
    }

    // Analiza sentiment pentru recenzii
    analyzeSentiment(text) {
        if (!text) return { score: 0, label: 'neutral' };

        const tokens = this.tokenize(text);
        let positiveScore = 0;
        let negativeScore = 0;

        tokens.forEach(token => {
            if (this.sentimentKeywords.positive.some(word => token.includes(word))) {
                positiveScore++;
            }
            if (this.sentimentKeywords.negative.some(word => token.includes(word))) {
                negativeScore++;
            }
        });

        const totalScore = positiveScore - negativeScore;
        let label = 'neutral';
        
        if (totalScore > 0) label = 'positive';
        else if (totalScore < 0) label = 'negative';

        return {
            score: totalScore,
            label: label,
            confidence: Math.min((Math.abs(totalScore) / tokens.length) * 100, 100)
        };
    }

    // Extrage caracteristici menționate în descriere/recenzii
    extractFeatures(text) {
        const tokens = this.tokenize(text);
        const mentionedFeatures = {};

        Object.entries(this.featureKeywords).forEach(([feature, keywords]) => {
            const mentions = tokens.filter(token => 
                keywords.some(keyword => token.includes(keyword))
            ).length;

            if (mentions > 0) {
                mentionedFeatures[feature] = mentions;
            }
        });

        return mentionedFeatures;
    }

    // Calculează similaritate între două texte (Cosine Similarity simplificat)
    calculateSimilarity(text1, text2) {
        const tokens1 = new Set(this.tokenize(text1));
        const tokens2 = new Set(this.tokenize(text2));

        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        
        if (tokens1.size === 0 || tokens2.size === 0) return 0;

        return (intersection.size * 2) / (tokens1.size + tokens2.size);
    }

    // Analiza completă a produsului
    analyzeProduct(product, searchQuery) {
        const titleKeywords = this.extractKeywords(product.title);
        const descKeywords = this.extractKeywords(product.description);
        
        // Similaritate cu query-ul de căutare
        const titleSimilarity = this.calculateSimilarity(product.title, searchQuery);
        const descSimilarity = this.calculateSimilarity(product.description, searchQuery);
        
        // Analiză sentiment din recenzii (doar dacă reviews e array)
        let sentimentAnalysis = { positive: 0, negative: 0, neutral: 1 };
        if (product.reviews && Array.isArray(product.reviews) && product.reviews.length > 0) {
            const reviewTexts = product.reviews.join(' ');
            sentimentAnalysis = this.analyzeSentiment(reviewTexts);
        }

        // Extrage caracteristici (verificăm dacă reviews e array)
        const reviewsText = (Array.isArray(product.reviews)) ? product.reviews.join(' ') : '';
        const features = this.extractFeatures(
            `${product.title} ${product.description} ${reviewsText}`
        );

        return {
            keywords: [...new Set([...titleKeywords, ...descKeywords])],
            titleSimilarity,
            descSimilarity,
            overallSimilarity: (titleSimilarity * 0.7 + descSimilarity * 0.3),
            sentiment: sentimentAnalysis,
            features,
            relevanceScore: this.calculateRelevanceScore({
                titleSimilarity,
                descSimilarity,
                sentiment: sentimentAnalysis
            })
        };
    }

    // Calculează scor de relevanță
    calculateRelevanceScore(analysis) {
        const { titleSimilarity, descSimilarity, sentiment } = analysis;
        
        let score = (titleSimilarity * 0.5 + descSimilarity * 0.2) * 100;
        
        // Bonus pentru sentiment pozitiv
        if (sentiment.label === 'positive') {
            score += sentiment.confidence * 0.3;
        } else if (sentiment.label === 'negative') {
            score -= sentiment.confidence * 0.2;
        }

        return Math.max(0, Math.min(100, score));
    }

    // Sugestii de query îmbunătățit
    enhanceSearchQuery(query) {
        const keywords = this.extractKeywords(query);
        const enhanced = {
            original: query,
            keywords: keywords,
            suggestions: []
        };

        // Adaugă sinonime și termeni relevanți
        const synonyms = {
            'laptop': ['notebook', 'ultrabook', 'calculator portabil'],
            'telefon': ['smartphone', 'mobile', 'telefon mobil'],
            'casti': ['căști', 'headphones', 'earbuds', 'earphones'],
            'tv': ['televizor', 'smart tv', 'led tv'],
            'tableta': ['tabletă', 'tablet', 'ipad']
        };

        keywords.forEach(keyword => {
            if (synonyms[keyword]) {
                enhanced.suggestions.push(...synonyms[keyword]);
            }
        });

        return enhanced;
    }
}

// Export pentru utilizare
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NLPEngine;
}