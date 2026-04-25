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
app.use(express.json({ limit: '8mb' }));

const allowedImageHosts = new Set([
    'darwin.md',
    'www.cactus.md',
    'cactus.md',
    'bomba.md',
    'ultra.md',
    'cdn.ultra.md',
    'pandashop.md',
    'www.pandashop.md',
    'cdn.pandashop.md',
    'atehno.md',
    'www.atehno.md'
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
    const cleanedQuery = cleanSearchTerm(compactQuery);
    const searchTerms = cleanedQuery ? [cleanedQuery] : [];
    const isRomanian = /[ДѓГўГ®И™ЕџИ›ЕЈ]|\b(cu|si|И™i|pentru|telefon|laptop|pret|preИ›)\b/i.test(compactQuery);

    return {
        searchTerms,
        intent: compactQuery,
        language: isRomanian ? 'ro' : 'en',
        filters: extractQueryFilters(compactQuery),
        fallback: true
    };
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function cleanSearchTerm(query) {
    const normalized = normalizeText(query)
        .replace(/\b(vreau|as vrea|doresc|caut|gaseste|gaseste-mi|un|o|una|bun|buna|ieftin|ieftina|recomanda|pentru|mine|te rog)\b/g, ' ')
        .replace(/\b(sub|pana la|maxim|maximum|buget|pret|lei|le|mdl|ron|euro|eur)\b\s*\d+|\d+\s*\b(lei|le|mdl|ron|euro|eur)\b/g, ' ')
        .replace(/\b(sub|pana la|maxim|maximum|buget|pret|lei|le|mdl|ron|euro|eur)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return normalized || String(query || '').trim();
}

function extractQueryFilters(query) {
    const normalized = normalizeText(query).replace(/\s+/g, ' ');
    const filters = {};

    const maxPricePatterns = [
        /\b(?:sub|pana la|maxim|maximum|buget(?: de)?|mai ieftin de)\s*(\d[\d\s.,]*)\s*(?:lei|le|mdl|ron|euro|eur)?\b/i,
        /\b(\d[\d\s.,]*)\s*(?:lei|le|mdl|ron|euro|eur)\s*(?:maxim|maximum)?\b/i
    ];

    for (const pattern of maxPricePatterns) {
        const match = normalized.match(pattern);
        if (match) {
            const parsed = Number(String(match[1]).replace(/[^\d]/g, ''));
            if (Number.isFinite(parsed) && parsed > 0) {
                filters.maxPrice = parsed;
                break;
            }
        }
    }

    if (/\b(bun|buna|calitativ|calitate|recomandat|best|good)\b/i.test(normalized)) {
        filters.sortBy = 'score';
        filters.minRating = 4.0;
    }

    if (/\b(in stoc|disponibil|available)\b/i.test(normalized)) {
        filters.inStock = true;
    }

    return filters;
}

const categorySignalKeywords = {
    phone: [
        'telefon', 'telefon mobil', 'smartphone', 'phone', 'mobil',
        'mobile phone', 'СЃРјР°СЂС‚С„РѕРЅ', 'С‚РµР»РµС„РѕРЅ'
    ],
    laptop: ['laptop', 'notebook', 'ultrabook', 'macbook'],
    tablet: ['tableta', 'tablet', 'ipad', 'РїР»Р°РЅС€РµС‚'],
    tv: ['televizor', 'tv', 'smart tv', 'oled', 'qled', 'С‚РµР»РµРІРёР·РѕСЂ'],
    audio: ['casti', 'headphones', 'earbuds', 'earphones', 'boxa', 'speaker', 'soundbar', 'РЅР°СѓС€РЅРёРєРё'],
    appliance: [
        'cuptor', 'plita', 'aragaz', 'frigider', 'masina de spalat', 'microunde',
        'boiler', 'hota', 'РІС‹С‚СЏР¶РєР°', 'РїР°РЅРµР»СЊ', 'РґСѓС…РѕРІРѕР№', 'С…РѕР»РѕРґРёР»СЊРЅРёРє', 'РїР»РёС‚Р°'
    ],
    grooming: [
        'masina de tuns', 'aparat de tuns', 'trimmer', 'hair clipper', 'clipper',
        'РјР°С€РёРЅРєР° РґР»СЏ СЃС‚СЂРёР¶РєРё', 'РјР°С€РёРЅРєР°', 'СЃС‚СЂРёР¶РєРё', 'С‚СЂРёРјРјРµСЂ'
    ],
    toothbrush: [
        'periuta de dinti', 'periuta electrica', 'sonicare', 'toothbrush',
        'electric toothbrush', 'Р·СѓР±РЅР°СЏ С‰РµС‚РєР°', 'С‰РµС‚РєР°'
    ],
    iron: [
        'fier de calcat', 'fier de călcat', 'statie de calcat', 'statie de călcat',
        'steam iron', 'clothes iron', 'утюг', 'паровой утюг', 'праска'
    ]
};

const categorySearchTerms = {
    phone: 'telefon',
    laptop: 'laptop',
    tablet: 'tableta',
    tv: 'televizor',
    audio: 'casti',
    appliance: 'electrocasnice',
    grooming: 'masina de tuns',
    toothbrush: 'periuta electrica',
    iron: ['fier de calcat', 'iron', 'утюг']
};

const brandSignalKeywords = {
    samsung: ['samsung', 'galaxy'],
    apple: ['apple', 'iphone', 'ipad', 'macbook'],
    xiaomi: ['xiaomi', 'redmi', 'poco'],
    huawei: ['huawei'],
    honor: ['honor'],
    nokia: ['nokia'],
    motorola: ['motorola', 'moto'],
    oppo: ['oppo'],
    realme: ['realme'],
    vivo: ['vivo'],
    google: ['google', 'pixel'],
    philips: ['philips', 'sonicare'],
    braun: ['braun'],
    panasonic: ['panasonic'],
    rowenta: ['rowenta'],
    remington: ['remington'],
};

const accessorySignalKeywords = [
    'husa', 'huse', 'case', 'cover', 'wallet', 'folio', 'bumper', 'toc',
    'sticla', 'sticla de protectie', 'tempered glass', 'glass',
    'screen protector', 'protector', 'privacy glass', 'folie',
    'cablu', 'cable', 'charger', 'incarcator', 'adapter', 'adaptor',
    'earbuds', 'headphones', 'casti', 'headset',
    'holder', 'stand', 'mount', 'dock',
    'battery', 'power bank', 'stylus', 'pen',
    'skin', 'film', 'lens protector', 'ring', 'strap',
    'С‡РµС…РѕР»', 'С‡РµС…Р»С‹', 'СЃС‚РµРєР»Рѕ', 'Р·Р°С‰РёС‚РЅРѕРµ СЃС‚РµРєР»Рѕ',
    'РєР°Р±РµР»СЊ', 'Р·Р°СЂСЏРґРЅРѕРµ', 'Р·Р°СЂСЏРґРєР°', 'Р°РґР°РїС‚РµСЂ', 'РґРµСЂР¶Р°С‚РµР»СЊ'
];

const nonTargetCommodityKeywords = [
    'vitamin', 'vitamine', 'supplement', 'supliment', 'capsule', 'tablete', 'pastile',
    'nutrition', 'nutritie', 'protein', 'whey', 'creatine', 'preworkout', 'amino',
    'shaker', 'balkan pharmaceuticals', 'gmp', 'iron c', 'iron chelate', 'resishi',
    'lion s mane', 'mushroom', 'bottle', 'flask', 'medicine', 'medicament'
];

const electronicsLikeCategories = new Set([
    'phone', 'laptop', 'tablet', 'tv', 'audio', 'appliance', 'grooming', 'toothbrush', 'iron'
]);

const stopWords = new Set([
    'si', 'И™i', 'de', 'la', 'in', 'Г®n', 'cu', 'pe', 'pentru', 'cel', 'cea',
    'mai', 'un', 'o', 'sau', 'dar', 'ca', 'cДѓ', 'este', 'sunt', 'foarte',
    'din', 'care', 'vreau', 'doresc', 'caut', 'bun', 'buna', 'buy', 'buying',
    'sub', 'pana', 'maxim', 'maximum', 'lei', 'le', 'mdl', 'ron', 'eur', 'euro'
]);

const genericQueryTokens = new Set([
    'telefon', 'telefonul', 'smartphone', 'phone', 'mobil', 'mobile',
    'telefonmobil', 'laptop', 'notebook', 'tablet', 'tableta', 'tv', 'televizor',
    'casti', 'headphones', 'earbuds', 'boxa', 'speaker', 'smart',
    'masina', 'aparat', 'tuns', 'periuta', 'dinti', 'toothbrush',
    'fier', 'calcat', 'calcare', 'iron', 'statie', 'steam',
    'СЃРјР°СЂС‚С„РѕРЅ', 'С‚РµР»РµС„РѕРЅ', 'РјР°С€РёРЅРєР°', 'СЃС‚СЂРёР¶РєРё', 'С‰РµС‚РєР°'
]);

function extractQueryTokens(text) {
    return normalizeText(text)
        .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);
}

function extractAnchorTokens(text) {
    return extractQueryTokens(text).filter((token) =>
        !stopWords.has(token) &&
        !/^\d+$/.test(token) &&
        !['lei', 'le', 'mdl', 'ron', 'eur', 'euro', 'sub', 'pana', 'maxim', 'maximum', 'buget'].includes(token)
    );
}

function looksLikeNonTargetCommodity(title) {
    const normalizedTitle = normalizeText(title);
    return nonTargetCommodityKeywords.some((keyword) =>
        normalizedTitle.includes(normalizeText(keyword))
    );
}

function detectSignals(text, signalsMap) {
    const normalizedText = normalizeText(text);
    const detected = new Set();

    for (const [key, keywords] of Object.entries(signalsMap)) {
        if (keywords.some((keyword) => normalizedText.includes(normalizeText(keyword)))) {
            detected.add(key);
        }
    }

    return detected;
}

function detectQueryCategories(text) {
    return detectSignals(text, categorySignalKeywords);
}

function detectQueryBrands(text) {
    return detectSignals(text, brandSignalKeywords);
}

function productCategoriesFromTitle(title) {
    return detectSignals(title, categorySignalKeywords);
}

function buildQueryContext(query, interpretation = {}) {
    const searchTerms = Array.isArray(interpretation?.searchTerms)
        ? interpretation.searchTerms.map((term) => String(term || '').trim()).filter(Boolean)
        : [];
    const combinedText = [query, ...searchTerms].join(' ');
    const categories = detectQueryCategories(combinedText);
    const brands = detectQueryBrands(combinedText);
    const brandTokens = new Set(
        Array.from(brands)
            .flatMap((brand) => brandSignalKeywords[brand] || [])
            .map((token) => normalizeText(token))
    );
    const tokens = extractQueryTokens(combinedText);
    const importantTokens = tokens.filter((token) =>
        !stopWords.has(token) &&
        !genericQueryTokens.has(token) &&
        !brandTokens.has(token)
    );
    const numbers = tokens.filter((token) => /^\d+$/.test(token));

    return {
        categories,
        brands,
        importantTokens,
        numbers,
        filters: interpretation?.filters && typeof interpretation.filters === 'object'
            ? interpretation.filters
            : {}
    };
}

function buildSearchVariants(query, interpretation = {}) {
    const rawTerms = Array.isArray(interpretation?.searchTerms)
        ? interpretation.searchTerms.map((term) => String(term || '').trim()).filter(Boolean)
        : [];
    const usefulTerms = rawTerms.filter((term) => {
        const normalized = normalizeText(term);
        return normalized &&
            !/^\d+([.,]\d+)?$/.test(normalized) &&
            !/^\d+\s*(lei|le|mdl|ron|eur|euro)$/.test(normalized) &&
            !['bun', 'buna', 'buy', 'buying'].includes(normalized);
    });

    const context = buildQueryContext(query, interpretation);
    const brands = Array.from(context.brands);
    const categories = Array.from(context.categories);

    const primaryBrand = brands[0] || '';
    const primaryCategory = categories[0] || '';
    const categoryTermsRaw = primaryCategory
        ? (categorySearchTerms[primaryCategory] || primaryCategory)
        : '';
    const categoryTerms = Array.isArray(categoryTermsRaw)
        ? categoryTermsRaw
        : (categoryTermsRaw ? [categoryTermsRaw] : []);
    const primaryCategoryTerm = categoryTerms[0] || '';
    const importantTerm = context.importantTokens.find((token) => !/^\d+$/.test(token)) || '';
    const cleanedFallback = cleanSearchTerm(query);

    const variants = [];
    const addVariant = (value) => {
        const normalized = String(value || '').trim().replace(/\s+/g, ' ');
        if (!normalized) return;
        if (/^\d+([.,]\d+)?$/.test(normalizeText(normalized))) return;
        if (/^\d+\s*(lei|le|mdl|ron|eur|euro)$/i.test(normalized)) return;
        variants.push(normalized);
    };

    if (primaryBrand && categoryTerms.length > 0) {
        for (const term of categoryTerms.slice(0, 3)) {
            addVariant(`${term} ${primaryBrand}`);
        }
    }
    if (primaryBrand) addVariant(primaryBrand);
    if (!primaryBrand && categoryTerms.length > 0) {
        for (const term of categoryTerms.slice(0, 3)) {
            addVariant(term);
        }
    }
    if (primaryBrand && importantTerm) addVariant(`${primaryBrand} ${importantTerm}`);
    if (primaryCategoryTerm && importantTerm) addVariant(`${primaryCategoryTerm} ${importantTerm}`);

    for (const term of usefulTerms) {
        if (!genericQueryTokens.has(normalizeText(term))) addVariant(term);
    }

    const cleanedTokens = extractQueryTokens(cleanedFallback).filter((token) =>
        !stopWords.has(token) &&
        !/^\d+$/.test(token) &&
        !['lei', 'le', 'mdl', 'ron', 'eur', 'euro', 'sub', 'pana', 'maxim', 'maximum', 'buget'].includes(token)
    );
    if (cleanedTokens.length > 0) {
        addVariant(cleanedTokens.slice(0, 4).join(' '));
    }

    if (variants.length === 0) {
        if (primaryCategoryTerm && primaryBrand) addVariant(`${primaryCategoryTerm} ${primaryBrand}`);
        else if (primaryBrand) addVariant(primaryBrand);
        else if (primaryCategoryTerm) addVariant(primaryCategoryTerm);
        else addVariant(cleanedFallback);
    }

    return Array.from(new Set(variants)).slice(0, 4);
}

function matchesContextBrand(title, context) {
    if (!context.brands || context.brands.size === 0) return true;

    const normalizedTitle = normalizeText(title);
    return Array.from(context.brands).some((brand) =>
        (brandSignalKeywords[brand] || []).some((keyword) =>
            normalizedTitle.includes(normalizeText(keyword))
        )
    );
}

function matchesContextCategory(title, context) {
    if (!context.categories || context.categories.size === 0) return true;
    const productCategories = productCategoriesFromTitle(title);
    return Array.from(context.categories).some((category) => productCategories.has(category));
}

function scoreProductByContext(product, query, context) {
    const normalizedTitle = normalizeText(product?.title || '');
    if (!normalizedTitle) return -1000;
    if (isLikelyAccessory(query, product.title)) return -1000;
    if (
        context.categories.size > 0 &&
        Array.from(context.categories).some((category) => electronicsLikeCategories.has(category)) &&
        looksLikeNonTargetCommodity(product.title)
    ) {
        return -950;
    }

    let score = 0;
    let categoryMatched = false;
    let brandMatched = context.brands.size === 0;

    const anchorTokens = extractAnchorTokens(query);
    const matchedAnchorTokens = anchorTokens.filter((token) =>
        normalizedTitle.includes(token)
    );

    if (context.brands.size > 0) {
        brandMatched = matchesContextBrand(product.title, context);
        if (!brandMatched) {
            return -900;
        }
        score += 45;
    }

    if (context.categories.size > 0) {
        categoryMatched = matchesContextCategory(product.title, context);
        if (!categoryMatched) {
            return -800;
        }
        score += 35;
    }

    const matchedImportantTokens = context.importantTokens.filter((token) =>
        normalizedTitle.includes(token)
    );
    if (context.importantTokens.length > 0) {
        if (matchedImportantTokens.length === 0 && context.brands.size === 0 && !categoryMatched) {
            return -700;
        }
        score += matchedImportantTokens.length * 15;
        score -= Math.max(0, context.importantTokens.length - matchedImportantTokens.length) * 4;
    }

    // Guard general anti-zgomot: produsul trebuie sa atinga minim intentul query-ului
    // prin brand/categorie sau macar un token anchor din cautare.
    if (anchorTokens.length >= 2 && matchedAnchorTokens.length === 0 && !brandMatched && !categoryMatched) {
        return -760;
    }
    if (anchorTokens.length >= 3 && matchedAnchorTokens.length === 0 && !categoryMatched) {
        return -740;
    }
    score += Math.min(12, matchedAnchorTokens.length * 4);

    const matchedNumbers = context.numbers.filter((token) =>
        normalizedTitle.includes(token)
    );
    score += matchedNumbers.length * 8;

    if (product.inStock) score += 5;
    if (Number.isFinite(Number(product.rating))) {
        score += Math.min(10, Number(product.rating) * 2);
    }
    if (Number.isFinite(Number(product.reviewCount))) {
        score += Math.min(8, Number(product.reviewCount) / 50);
    }

    const maxPrice = Number(context.filters?.maxPrice || 0);
    if (maxPrice > 0) {
        score += Number(product.price) <= maxPrice ? 10 : -12;
    }

    return score;
}

function dedupeProducts(products) {
    const seen = new Set();
    const deduped = [];

    for (const product of products) {
        const key = `${product.store}|${product.productUrl}|${product.title}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(product);
    }

    return deduped;
}

function isLikelyAccessory(query, title) {
    const normalizedTitle = normalizeText(title);
    const normalizedQuery = normalizeText(query);

    if (!normalizedTitle || !normalizedQuery) return false;

    const queryTokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 1);
    const titleContainsQuerySignal = queryTokens.some((token) => normalizedTitle.includes(token));
    const hasAccessoryKeyword = accessorySignalKeywords.some((keyword) =>
        normalizedTitle.includes(normalizeText(keyword))
    );

    return titleContainsQuerySignal && hasAccessoryKeyword;
}

let cachedGeminiModelName = null;
let cachedGeminiModelCheckedAt = 0;

async function resolveGeminiModelName(requestedModel) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return requestedModel;

    const now = Date.now();
    if (cachedGeminiModelName && now - cachedGeminiModelCheckedAt < 10 * 60 * 1000) {
        return cachedGeminiModelName;
    }

    const preferredModels = [
        requestedModel,
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash-002',
        'gemini-1.5-flash-001'
    ].filter(Boolean);

    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
            method: 'GET',
            headers: {
                'x-goog-api-key': apiKey
            }
        });

        if (!response.ok) {
            cachedGeminiModelName = requestedModel;
            cachedGeminiModelCheckedAt = now;
            return requestedModel;
        }

        const payload = await response.json();
        const available = Array.isArray(payload?.models) ? payload.models : [];
        const supported = available
            .filter((model) =>
                Array.isArray(model?.supportedGenerationMethods) &&
                model.supportedGenerationMethods.includes('generateContent'))
            .map((model) => String(model.name || '').replace(/^models\//, ''))
            .filter(Boolean);

        const selected =
            preferredModels.find((name) => supported.includes(name)) ||
            supported.find((name) => name.includes('flash')) ||
            requestedModel;

        cachedGeminiModelName = selected;
        cachedGeminiModelCheckedAt = now;
        return selected;
    } catch (_) {
        cachedGeminiModelName = requestedModel;
        cachedGeminiModelCheckedAt = now;
        return requestedModel;
    }
}

async function generateContentWithGemini(prompt, options = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { ok: false, status: 401, model: null, text: '' };
    }

    const configuredModel = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const resolvedModel = await resolveGeminiModelName(configuredModel);
    const modelCandidates = Array.from(new Set([
        resolvedModel,
        'gemini-2.5-flash',
        'gemini-1.5-flash-002',
        'gemini-1.5-flash-001'
    ].filter(Boolean)));

    for (const model of modelCandidates) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                options.timeoutMs || 15000
            );

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
                            temperature: options.temperature ?? 0,
                            responseMimeType: options.responseMimeType || 'application/json'
                        }
                    })
                }
            );

            clearTimeout(timeoutId);

            if (response.status === 404) {
                continue;
            }

            const payload = await response.json().catch(() => ({}));
            const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            if (!response.ok) {
                return { ok: false, status: response.status, model, text };
            }

            return { ok: true, status: response.status, model, text };
        } catch (error) {
            if (String(error?.message || '').toLowerCase().includes('aborted')) {
                return { ok: false, status: 408, model, text: '' };
            }
        }
    }

    return { ok: false, status: 404, model: configuredModel, text: '' };
}

async function interpretQueryWithAi(query) {
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const fallback = buildFallbackInterpretation(query);

    const systemPrompt =
        'You interpret ecommerce search queries. ' +
        'Return ONLY valid JSON with this shape: ' +
        '{"searchTerms":["..."],"intent":"...","language":"ro|en","filters":{"maxPrice":8000,"minRating":4,"inStock":true,"sortBy":"score|price-asc|price-desc|rating"},"fallback":false}. ' +
        'Keep searchTerms short, practical, and focused on the main product. ' +
        'Convert natural requests like "vreau un telefon bun sub 8000 lei" to searchTerms ["telefon"] and filters {"maxPrice":8000,"minRating":4,"sortBy":"score"}.';

    const userPrompt =
        `User query: "${query}"\n` +
        'Infer the main buying intent, normalize the search terms, detect language, and extract price/quality/availability filters. ' +
        'Return JSON only.';

    try {
        if (GEMINI_API_KEY) {
            const geminiResult = await generateContentWithGemini(
                `${systemPrompt}\n\n${userPrompt}`,
                {
                    model: GEMINI_MODEL,
                    timeoutMs: 15000,
                    temperature: 0,
                    responseMimeType: 'application/json'
                }
            );

            if (geminiResult.ok) {
                const content = geminiResult.text;
                const jsonText = extractFirstJsonObject(content);
                if (jsonText) {
                    const parsed = JSON.parse(jsonText);
                    const parsedSearchTerms = Array.isArray(parsed?.searchTerms)
                        ? parsed.searchTerms.map((term) => cleanSearchTerm(term)).filter(Boolean)
                        : [];
                    const filters = {
                        ...extractQueryFilters(query),
                        ...(parsed?.filters && typeof parsed.filters === 'object' ? parsed.filters : {})
                    };

                    return {
                        searchTerms: parsedSearchTerms.length > 0
                            ? parsedSearchTerms.slice(0, 3)
                            : [cleanSearchTerm(query)],
                        intent: String(parsed?.intent || fallback.intent).trim() || fallback.intent,
                        language: parsed?.language === 'en' ? 'en' : 'ro',
                        filters,
                        fallback: false
                    };
                }
            } else {
                console.warn(`Gemini interpretation skipped (${geminiResult.model}): HTTP ${geminiResult.status}`);
            }
        }

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
            searchTerms: parsedSearchTerms.length > 0
                ? parsedSearchTerms.map((term) => cleanSearchTerm(term)).slice(0, 3)
                : [cleanSearchTerm(query)],
            intent: String(parsed?.intent || fallback.intent).trim() || fallback.intent,
            language: parsed?.language === 'ro' ? 'ro' : fallback.language,
            filters: {
                ...extractQueryFilters(query),
                ...(parsed?.filters && typeof parsed.filters === 'object' ? parsed.filters : {})
            },
            fallback: false
        };
    } catch (error) {
        console.warn(`вљ пёЏ interpretQueryWithAi fallback: ${error.message}`);
        return fallback;
    }
}

async function aiFilterProducts(query, products) {
    if (!Array.isArray(products) || products.length === 0) return products;

    const heuristicFiltered = products.filter((product) => !isLikelyAccessory(query, product.title));
    const candidateProducts = heuristicFiltered.length > 0 ? heuristicFiltered : products;

    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

    // Trimitem Г®n batch-uri de 40 ca sДѓ nu depДѓИ™im contextul modelului
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
                console.warn(`вљ пёЏ  Ollama batch ${i}-${i + BATCH_SIZE} skipped: HTTP ${response.status}`);
                // DacДѓ Ollama nu e disponibil, returnДѓm produsele nemodificate
                batch.forEach((p) => relevantIds.add(p.id));
                continue;
            }

            const payload = await response.json();
            const content = payload?.message?.content || '';
            console.log(`рџ¤– Ollama rДѓspuns batch ${Math.floor(i / BATCH_SIZE) + 1}:`, content.slice(0, 300));

            const jsonText = extractFirstJsonObject(content);
            if (!jsonText) {
                console.warn('вљ пёЏ  Ollama nu a returnat JSON valid, pДѓstrДѓm batch-ul nefiltrat');
                batch.forEach((p) => relevantIds.add(p.id));
                continue;
            }

            const parsed = JSON.parse(jsonText);
            const batchRelevant = Array.isArray(parsed?.relevant) ? parsed.relevant : [];

            if (batchRelevant.length === 0) {
                console.log(`в„№пёЏ  Ollama: niciun produs relevant Г®n batch-ul ${Math.floor(i / BATCH_SIZE) + 1}`);
            } else {
                batchRelevant.forEach((id) => relevantIds.add(id));
            }
        } catch (error) {
            console.warn(`вљ пёЏ  Ollama batch ${i} error: ${error.message} вЂ” batch pДѓstrat nefiltrat`);
            batch.forEach((p) => relevantIds.add(p.id));
        }
    }

    const filtered = candidateProducts.filter((p) => relevantIds.has(p.id));
    console.log(`рџ¤– Ollama filtru: ${products.length} в†’ ${candidateProducts.length} в†’ ${filtered.length} produse relevante`);
    return filtered.length > 0 ? filtered : candidateProducts;
}

async function filterProductsWithGemini(query, products, interpretation = {}) {
    if (!Array.isArray(products) || products.length === 0) return products;

    const context = buildQueryContext(query, interpretation);
    const scoredCandidates = dedupeProducts(products)
        .map((product) => ({
            product,
            heuristicScore: scoreProductByContext(product, query, context)
        }))
        .filter(({ heuristicScore }) => heuristicScore > -500)
        .sort((a, b) => b.heuristicScore - a.heuristicScore);

    const candidateProducts = (scoredCandidates.length > 0
        ? scoredCandidates
        : dedupeProducts(products).map((product) => ({ product, heuristicScore: 0 })))
        .map(({ product }) => product);

    const apiKey = process.env.GEMINI_API_KEY;
    const configuredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!apiKey) {
        console.warn('GEMINI_API_KEY missing, using heuristic filter only');
        return candidateProducts;
    }

    const limitedCandidates = candidateProducts.slice(0, 120);
    const BATCH_SIZE = 40;
    const relevantIds = new Set();
    const contextSummary = JSON.stringify({
        categories: Array.from(context.categories),
        brands: Array.from(context.brands),
        filters: context.filters,
        importantTokens: context.importantTokens,
        numbers: context.numbers
    });

    for (let i = 0; i < limitedCandidates.length; i += BATCH_SIZE) {
        const batch = limitedCandidates.slice(i, i + BATCH_SIZE);
        const candidates = batch.map((product) => ({
            id: product.id,
            title: product.title,
            store: product.store,
            price: product.price,
            inStock: product.inStock
        }));

        const prompt =
            'You filter ecommerce search results for a price comparison app.\n' +
            `User query: "${query}"\n` +
            `Structured context: ${contextSummary}\n\n` +
            'Return ONLY valid JSON with this exact shape: {"relevant":["id1","id2"]}.\n' +
            'Keep only products that match the same category, brand, and purchase intent.\n' +
            'Exclude accessories and unrelated products in any language, including chargers, cables, cases, protective glass, adapters, holders, and home appliances when the query is for a phone.\n' +
            'Keep close variants of the same target product such as color or storage differences.\n\n' +
            `Products:\n${JSON.stringify(candidates)}`;

        try {
            const geminiResult = await generateContentWithGemini(prompt, {
                model: configuredModel,
                timeoutMs: 30000,
                temperature: 0,
                responseMimeType: 'application/json'
            });

            if (!geminiResult.ok) {
                console.warn(`Gemini batch ${i}-${i + BATCH_SIZE} skipped (${geminiResult.model}): HTTP ${geminiResult.status}`);
                batch.forEach((product) => relevantIds.add(product.id));
                continue;
            }

            const content = geminiResult.text;
            const jsonText = extractFirstJsonObject(content);
            if (!jsonText) {
                console.warn('Gemini did not return valid JSON, keeping batch');
                batch.forEach((product) => relevantIds.add(product.id));
                continue;
            }

            const parsed = JSON.parse(jsonText);
            const batchRelevant = Array.isArray(parsed?.relevant) ? parsed.relevant : [];
            batchRelevant.forEach((id) => relevantIds.add(String(id)));
        } catch (error) {
            console.warn(`Gemini batch ${i} error: ${error.message}, keeping batch`);
            batch.forEach((product) => relevantIds.add(product.id));
        }
    }

    const filtered = candidateProducts.filter((product) => relevantIds.has(product.id));
    const minimumUsefulResults = Math.min(12, Math.ceil(candidateProducts.length * 0.2));

    if (filtered.length < minimumUsefulResults && candidateProducts.length > minimumUsefulResults) {
        console.warn(`Gemini filter too aggressive (${candidateProducts.length} -> ${filtered.length}), using heuristic output`);
        return candidateProducts;
    }

    console.log(`Gemini filter: ${products.length} -> ${candidateProducts.length} -> ${filtered.length}`);
    return filtered.length > 0 ? filtered : candidateProducts;
}

async function filterAndRankProducts(query, products, interpretation = {}) {
    if (!Array.isArray(products) || products.length === 0) return [];

    const context = buildQueryContext(query, interpretation);
    const scoredProducts = dedupeProducts(products)
        .map((product) => ({
            product,
            heuristicScore: scoreProductByContext(product, query, context)
        }))
        .filter(({ heuristicScore }) => heuristicScore > -500)
        .sort((a, b) => b.heuristicScore - a.heuristicScore);

    const heuristicCandidates = scoredProducts.length > 0
        ? scoredProducts
        : dedupeProducts(products).map((product) => ({ product, heuristicScore: 0 }));

    const maxPrice = Number(context.filters?.maxPrice || 0);
    const requireInStock = context.filters?.inStock === true;

    // Aplicam filtrele hard devreme, inainte de AI rerank/top-candidate trimming,
    // ca sa nu pierdem produse corecte din alte magazine.
    let prefilteredCandidates = heuristicCandidates;
    if (maxPrice > 0) {
        const withinBudgetEarly = prefilteredCandidates.filter(({ product }) =>
            Number(product.price) <= maxPrice
        );
        if (withinBudgetEarly.length > 0) {
            prefilteredCandidates = withinBudgetEarly;
        }
    }
    if (requireInStock) {
        const inStockEarly = prefilteredCandidates.filter(({ product }) => product.inStock);
        if (inStockEarly.length > 0) {
            prefilteredCandidates = inStockEarly;
        }
    }

    const filteredWithAi = await filterProductsWithGemini(
        query,
        prefilteredCandidates.map(({ product }) => product),
        interpretation
    );
    const aiIds = new Set(filteredWithAi.map((product) => product.id));

    let finalRanked = prefilteredCandidates
        .filter(({ product }) => aiIds.size === 0 || aiIds.has(product.id));
    if (finalRanked.length === 0) {
        finalRanked = prefilteredCandidates;
    }

    if (maxPrice > 0) {
        const withinBudget = finalRanked.filter(({ product }) => Number(product.price) <= maxPrice);
        if (withinBudget.length > 0) {
            finalRanked = withinBudget;
        }
    }

    if (context.filters?.inStock === true) {
        const inStockOnly = finalRanked.filter(({ product }) => product.inStock);
        if (inStockOnly.length > 0) {
            finalRanked = inStockOnly;
        }
    }

    return finalRanked.map(({ product, heuristicScore }) => ({
        ...product,
        recommendationScore: Math.round(Math.max(0, heuristicScore))
    }));
}

// FuncИ›ie helper pentru delay Г®ntre request-uri
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ConfiguraИ›ie selectori pentru fiecare magazin
const storeConfigs = {
    darwin: {
        name: 'Darwin.md',
        icon: 'рџ¦Ћ',
        // TEMPORARY: folosim pagina de categorie Г®n loc de search (Livewire issues)
        searchUrl: (query) => {
            // Pentru iPhone/Apple cДѓutДѓri, foloseИ™te categoria Apple
            if (query.toLowerCase().includes('iphone') || query.toLowerCase().includes('apple')) {
                return `https://darwin.md/telefoane/smartphone/apple-iphone`;
            }
            // Pentru alte cДѓutДѓri, Г®ncearcДѓ search-ul normal
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
        icon: 'рџЊµ',
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
        icon: 'рџ’Ј',
        searchUrl: (query) => {
            const normalized = normalizeText(query);
            if (
                normalized.includes('fier de calcat') ||
                normalized.includes('fier calcat') ||
                normalized.includes('iron') ||
                normalized.includes('утюг')
            ) {
                // Bomba indexeaza mai complet aceasta categorie pe pagina RO decat in search.
                return 'https://bomba.md/ro/category/fieruri-de-calcat-634112/';
            }
            return `https://bomba.md/ru/poisk/?query=${encodeURIComponent(query)}`;
        },
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
        icon: 'вљЎ',
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
        icon: 'рџђј',
        searchUrl: (query) => `https://pandashop.md/ro/search/?text=${encodeURIComponent(query)}`,
        selectors: {
            productCard: '.js-itemsList.cardsList .card.js-itemsList-item',
            title: '.card-title .lnk-txt, [itemprop="name"]',
            price: '.card-price_curr, meta[itemprop="price"]',
            image: 'meta[itemprop="image"], picture source[srcset], img[itemprop="image"], img',
            link: 'a.card-title, a[href*="/product/"]',
            availability: 'link[itemprop="availability"]'
        }
    },
    atehno: {
        name: 'Atehno.md',
        icon: 'AT',
        searchUrl: (query) => `https://atehno.md/search/catalog?keywords=${encodeURIComponent(query)}`,
        selectors: {
            productCard: '#products article.product-item',
            title: 'h3 a',
            price: '.price ins .amount, .price .amount',
            image: 'a.img-wr img',
            link: 'h3 a, a.img-wr',
            availability: '.product-available-label'
        }
    }
};

// FuncИ›ie de scraping pentru un magazin specific
async function scrapeStore(browser, storeName, query, config) {
    const page = await browser.newPage();
    
    try {
        console.log(`рџ”Ќ Scraping ${config.name} pentru: ${query}`);
        
        // SeteazДѓ user agent pentru a pДѓrea browser normal
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // NavigheazДѓ la pagina de cДѓutare
        const searchUrl = config.searchUrl(query);
        console.log(`рџ“Ў URL: ${searchUrl}`);
        await page.goto(searchUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 25000
        });
        
        // AИ™teaptДѓ ca produsele sДѓ se Г®ncarce (JavaScript dinamic)
        try {
            await page.waitForSelector(config.selectors.productCard, { timeout: 5000 });
            console.log(`вњ… Selectorul ${config.selectors.productCard} gДѓsit!`);
        } catch (e) {
            console.log(`вљ пёЏ Nu s-au gДѓsit produse cu selectorul ${config.selectors.productCard}`);
        }
        
        // Delay suplimentar pentru siguranta
        await delay(600);
        
        // SCROLL AUTOMAT pentru a Г®ncДѓrca toate produsele (scroll infinit)
        console.log(`рџ“њ ГЋncep scroll automat pentru a Г®ncДѓrca toate produsele...`);
        let previousHeight = 0;
        let scrollAttempts = 0;
        const maxScrolls = 6; // Maxim 6 scroll-uri pentru a limita timpul
        
        while (scrollAttempts < maxScrolls) {
            // Scroll la sfГўrИ™itul paginii
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await delay(700); // AИ™teaptДѓ Г®ncДѓrcarea
            
            // VerificДѓ dacДѓ s-au Г®ncДѓrcat mai multe produse
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            const productCount = await page.evaluate((selector) => 
                document.querySelectorAll(selector).length, 
                config.selectors.productCard
            );
            
            console.log(`  Scroll ${scrollAttempts + 1}: ${productCount} produse gДѓsite`);
            
            // DacДѓ Г®nДѓlИ›imea nu s-a schimbat, nu mai sunt produse
            if (currentHeight === previousHeight) {
                console.log(`вњ… Nu mai sunt produse de Г®ncДѓrcat`);
                break;
            }
            
            previousHeight = currentHeight;
            scrollAttempts++;
        }
        
        // Scroll Г®napoi sus
        await page.evaluate(() => window.scrollTo(0, 0));
        await delay(500);
        
        // Extrage produsele
        const products = await page.evaluate((selectors, storeName, storeIcon, storeUrl) => {
            const productCards = document.querySelectorAll(selectors.productCard);
            console.log(`рџ”Ќ GДѓsite ${productCards.length} carduri cu selectorul: ${selectors.productCard}`);
            const results = [];
            
            productCards.forEach((card, index) => {
                try {
                    // Extrage titlul
                    const titleEl = card.querySelector(selectors.title);
                    const title = titleEl
                        ? ((titleEl.getAttribute && titleEl.getAttribute('content')) || titleEl.textContent || '').trim()
                        : null;
                    
                    console.log(`  Card ${index}: title="${title}"`);
                    
                    if (!title || title.length < 3) return; // Skip dacДѓ nu e titlu valid
                    
                    // Extrage preИ›ul
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
                        // NormalizeazДѓ URL-ul imaginii
                        if (image.startsWith('//')) {
                            image = 'https:' + image;
                        } else if (image.startsWith('/')) {
                            image = window.location.origin + image;
                        }
                    }
                    
                    // Extrage link-ul cДѓtre produs
                    const linkEl = card.querySelector(selectors.link) || card.closest('a');
                    let productUrl = storeUrl;
                    if (linkEl) {
                        productUrl = linkEl.href || linkEl.getAttribute('href') || storeUrl;
                        // NormalizeazДѓ URL-ul
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
                    const availabilityMeta = availabilityEl
                        ? `${availabilityEl.getAttribute('class') || ''} ${availabilityEl.getAttribute('title') || ''} ${availabilityEl.textContent || ''}`.toLowerCase()
                        : '';
                    const stockText = (card.textContent || '').toLowerCase();
                    const explicitOutOfStock =
                        availabilityHref.includes('OutOfStock') ||
                        availabilityMeta.includes('outofstock') ||
                        availabilityMeta.includes('item-only-order') ||
                        availabilityMeta.includes('под заказ') ||
                        availabilityMeta.includes('нет в наличии') ||
                        stockText.includes('indisponibil') ||
                        stockText.includes('stoc epuizat') ||
                        stockText.includes('под заказ') ||
                        stockText.includes('нет в наличии') ||
                        stockText.includes('out of stock');
                    const explicitInStock =
                        availabilityHref.includes('InStock') ||
                        availabilityMeta.includes('instock') ||
                        availabilityMeta.includes('item-available') ||
                        availabilityMeta.includes('в наличии');
                    const inStock = explicitInStock ? true : !explicitOutOfStock;

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
                        rating: 4 + Math.random(), // Random rating Г®ntre 4-5
                        reviewCount: Math.floor(Math.random() * 100) + 10,
                        reviews: [],
                        availability: inStock ? 'ГЋn stoc' : 'Indisponibil',
                        inStock: inStock  // Pentru filtrul frontend
                    });
                } catch (err) {
                    console.error('Error parsing product card:', err);
                }
            });
            
            return results;
        }, config.selectors, config.name, config.icon, config.searchUrl(query).split('?')[0]);
        
        console.log(`вњ… ${config.name}: ${products.length} produse gДѓsite`);
        
        await page.close();
        return products;
        
    } catch (error) {
        console.error(`вќЊ Error scraping ${config.name}:`, error.message);
        await page.close();
        return [];
    }
}

async function scrapeAcrossStores(browser, normalizedQuery) {
    const scrapePromises = Object.entries(storeConfigs).map(([storeName, config]) =>
        scrapeStore(browser, config.name, normalizedQuery, config)
            .catch((error) => {
                console.error(`Error in ${storeName}:`, error);
                return [];
            })
    );

    const results = await Promise.all(scrapePromises);
    const allProducts = dedupeProducts(results.flat());
    console.log(`Total produse scraped: ${allProducts.length}`);
    return allProducts;
}

function normalizeStoreName(value) {
    return normalizeText(String(value || ''))
        .replace(/\.md$/i, '')
        .trim();
}

function extractPaymentMethodsFromText(text) {
    const normalized = normalizeText(text);
    const matches = [];

    const signals = [
        { label: 'Card', patterns: ['card', 'visa', 'mastercard'] },
        { label: 'Cash', patterns: ['ramburs', 'numerar', 'cash'] },
        { label: 'Rate', patterns: ['rate', 'credit', 'leasing', 'in rate'] },
        { label: 'Transfer', patterns: ['transfer', 'ordin de plata', 'iban'] }
    ];

    for (const signal of signals) {
        if (signal.patterns.some((pattern) => normalized.includes(normalizeText(pattern)))) {
            matches.push(signal.label);
        }
    }

    return Array.from(new Set(matches));
}

async function scrapeBombaProductMeta(browser, productUrl) {
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await delay(900);

        const meta = await page.evaluate(() => {
            const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim();
            const textFromNode = (node) => compact(node?.innerText || node?.textContent || '');

            const deliveryOptions = [];
            const deliverySection = document.querySelector('.delivery-section');
            if (deliverySection) {
                const wrappers = Array.from(deliverySection.querySelectorAll('li .item-wrapper'));
                wrappers.forEach((wrapper) => {
                    const paragraphs = Array.from(wrapper.querySelectorAll('p')).map((p) => textFromNode(p)).filter(Boolean);
                    if (paragraphs.length === 0) return;

                    const locationText = paragraphs[0];
                    const priceText = paragraphs.find((line) => /\d+\s*lei/i.test(line)) || '';
                    const match = priceText.match(/(\d{2,5})\s*lei/i);
                    if (!match) return;

                    deliveryOptions.push({
                        method: locationText,
                        priceLei: Number(match[1]),
                        label: `${locationText} ${match[1]} lei`
                    });
                });
            }

            const pickupSummary = textFromNode(
                deliverySection?.querySelector('.count_shops_availability')?.closest('span,div,li')
            );
            const pickupMeta = textFromNode(deliverySection?.querySelector('.meta'));
            const availabilitySummary = [pickupSummary, pickupMeta].filter(Boolean).join(' | ');

            let warrantyValue = '';
            const specRows = Array.from(document.querySelectorAll('tr.attribute-item'));
            const warrantyRow = specRows.find((row) => {
                const label = textFromNode(row.querySelector('.attribute-name'));
                return /garantie|garanție|warranty|гарант/i.test(label);
            });
            if (warrantyRow) {
                const rawValue = textFromNode(warrantyRow.querySelector('.attribute-value'));
                const numericMatch = rawValue.match(/(\d{1,3})/);
                warrantyValue = numericMatch ? `${numericMatch[1]} luni` : rawValue;
            }

            const descriptionMeta = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const bodyText = compact(document.body.innerText || '');
            const paymentText = `${descriptionMeta} ${bodyText}`;

            return {
                deliveryOptions,
                availabilitySummary,
                warrantySummary: warrantyValue,
                paymentText
            };
        });

        const deliveryMinLei = meta.deliveryOptions.length > 0
            ? Math.min(...meta.deliveryOptions.map((item) => Number(item.priceLei)).filter(Number.isFinite))
            : null;

        return {
            store: 'Bomba',
            productUrl,
            deliveryOptions: meta.deliveryOptions,
            deliverySummary: meta.deliveryOptions.map((item) => item.label).slice(0, 4).join(' | '),
            deliveryMinLei: Number.isFinite(deliveryMinLei) ? deliveryMinLei : null,
            availabilitySummary: meta.availabilitySummary || null,
            warrantySummary: meta.warrantySummary || null,
            paymentMethods: extractPaymentMethodsFromText(meta.paymentText)
        };
    } finally {
        await page.close();
    }
}

async function scrapeProductMeta(store, productUrl) {
    const normalizedStore = normalizeStoreName(store);
    if (!normalizedStore) {
        throw new Error('Store is required');
    }

    if (!productUrl) {
        throw new Error('Product URL is required');
    }

    if (!/^https?:\/\//i.test(productUrl)) {
        throw new Error('Product URL must start with http/https');
    }

    const browser = await launchBrowser();
    try {
        if (normalizedStore.includes('bomba')) {
            return await scrapeBombaProductMeta(browser, productUrl);
        }
        throw new Error(`Store "${store}" not supported yet for product meta`);
    } finally {
        await browser.close();
    }
}

async function launchBrowser() {
    console.log('Lansez Puppeteer browser...');
    const possibleChromePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
    ];
    const systemChrome = possibleChromePaths.find((candidatePath) => fs.existsSync(candidatePath));

    const browser = await puppeteer.launch({
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
    console.log('Puppeteer browser lansat cu succes');
    return browser;
}

async function scrapeSearchQuery(query, useAiRerank = false, providedBrowser = null) {
    const normalizedQuery = String(query || '').trim();
    const cacheKey = `search_${normalizedQuery.toLowerCase()}_ai_${useAiRerank ? '1' : '0'}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        console.log('Returnat din cache');
        return cached;
    }

    const browser = providedBrowser || await launchBrowser();
    const shouldCloseBrowser = !providedBrowser;

    try {
        const allProducts = await scrapeAcrossStores(browser, normalizedQuery);

        let finalProducts = allProducts;
        if (useAiRerank) {
            finalProducts = await aiFilterProducts(normalizedQuery, allProducts);
        }

        cache.set(cacheKey, finalProducts);
        return finalProducts;
    } catch (error) {
        console.error('Server error:', error);
        throw error;
    } finally {
        if (shouldCloseBrowser && browser) {
            await browser.close();
        }
    }
}

async function smartSearchProducts(query) {
    const normalizedQuery = String(query || '').trim();
    const smartCacheKey = `smart_search_${normalizeText(normalizedQuery)}`;
    const cachedSmartResult = cache.get(smartCacheKey);
    if (cachedSmartResult) {
        return cachedSmartResult;
    }

    const interpretation = await interpretQueryWithAi(normalizedQuery);
    const searchVariants = buildSearchVariants(normalizedQuery, interpretation);
    const allProducts = [];
    let browser = null;

    try {
        browser = await launchBrowser();

        for (let index = 0; index < searchVariants.length; index += 1) {
            const searchVariant = searchVariants[index];
            console.log(`Smart search variant: "${searchVariant}"`);
            const variantProducts = await scrapeSearchQuery(searchVariant, false, browser);
            allProducts.push(...variantProducts);

            // Daca prima varianta deja intoarce rezultate din cel putin 2 magazine,
            // nu mai rulam varianta foarte generica ce aduce mult zgomot ("telefon").
            const currentMerged = dedupeProducts(allProducts);
            const storesCovered = new Set(currentMerged.map((product) => product.store)).size;
            const normalizedVariant = normalizeText(searchVariant);
            const isGenericVariant = genericQueryTokens.has(normalizedVariant) || normalizedVariant.length <= 3;
            if (storesCovered >= 2 && index > 0 && isGenericVariant) {
                break;
            }
        }

        const mergedProducts = dedupeProducts(allProducts);
        const rankedProducts = await filterAndRankProducts(
            normalizedQuery,
            mergedProducts,
            interpretation
        );

        const smartResult = {
            interpretation: {
                ...interpretation,
                searchVariants
            },
            products: rankedProducts
        };
        cache.set(smartCacheKey, smartResult);
        return smartResult;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
// Endpoint principal de cДѓutare
app.post('/interpret-query', async (req, res) => {
    const query = String(req.body?.query || '').trim();

    if (!query) {
        return res.status(400).json({ error: 'Body field "query" is required' });
    }

    const interpretation = await interpretQueryWithAi(query);
    res.json(interpretation);
});

app.get('/smart-search', async (req, res) => {
    const query = String(req.query.q || '').trim();

    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    try {
        const result = await smartSearchProducts(query);
        res.json(result);
    } catch (error) {
        console.error('Smart search error:', error.message);
        res.status(500).json({
            error: 'Failed to complete smart search',
            message: error.message
        });
    }
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
        const filteredProducts = await filterProductsWithGemini(query, products, {
            filters: extractQueryFilters(query)
        });
        res.json(filteredProducts);
    } catch (error) {
        console.error('Gemini filter endpoint error:', error.message);
        res.json(products.filter((product) => !isLikelyAccessory(query, product.title)));
    }
});

app.get('/search', async (req, res) => {
    const query = String(req.query.q || '').trim();

    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    console.log(`\n🔎 Căutare nouă: "${query}"`);

    try {
        const smartResult = await smartSearchProducts(query);
        const finalProducts = Array.isArray(smartResult?.products)
            ? smartResult.products
            : [];
        console.log(`✨ Total final: ${finalProducts.length} produse returnate`);
        res.json(finalProducts);
    } catch (error) {
        console.error('❌ Server error:', error);
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

app.get('/product-meta', async (req, res) => {
    const store = String(req.query.store || '').trim();
    const productUrl = String(req.query.url || '').trim();

    if (!store) {
        return res.status(400).json({ error: 'Query parameter "store" is required' });
    }
    if (!productUrl) {
        return res.status(400).json({ error: 'Query parameter "url" is required' });
    }

    const cacheKey = `product_meta_${normalizeStoreName(store)}_${productUrl}`;
    const cachedMeta = cache.get(cacheKey);
    if (cachedMeta) {
        return res.json(cachedMeta);
    }

    try {
        const meta = await scrapeProductMeta(store, productUrl);
        cache.set(cacheKey, meta, 60 * 60);
        res.json(meta);
    } catch (error) {
        console.error('Product meta error:', error.message);
        res.status(500).json({
            error: 'Failed to extract product metadata',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'PulsePrice API',
        endpoints: [
            '/health',
            '/search?q=iphone',
            '/search?q=iphone&ai=1',
            '/product-meta?store=Bomba&url=https://bomba.md/ro/product/...'
        ]
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'PulsePrice Scraper Server is running!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`\nрџљЂ PulsePrice Scraper Server pornit pe http://localhost:${PORT}`);
    console.log(`рџ“ќ Test: http://localhost:${PORT}/search?q=iPhone`);
    console.log(`рџ’љ Health: http://localhost:${PORT}/health\n`);
});

