import 'dart:math';
import '../models/product.dart';
import 'nlp_engine.dart';

class RecommendationEngine {
  final NLPEngine nlpEngine;

  final Map<String, double> weights = {
    'price': 0.25,
    'rating': 0.30,
    'reviews': 0.15,
    'availability': 0.10,
    'relevance': 0.20,
  };

  final Map<String, List<String>> categoryKeywords = {
    'phone': [
      'telefon', 'smartphone', 'iphone', 'galaxy', 'redmi', 'pixel', 'phone', 'mobil',
      'телефон', 'смартфон', 'mobile phone'
    ],
    'laptop': ['laptop', 'notebook', 'ultrabook', 'macbook'],
    'tablet': ['tableta', 'tablet', 'ipad'],
    'tv': ['televizor', 'tv', 'qled', 'oled', 'smart tv', 'телевизор'],
    'audio': ['casti', 'headphones', 'earbuds', 'boxa', 'speaker', 'soundbar'],
    'appliance': [
      'cuptor', 'plita', 'aragaz', 'frigider', 'masina de spalat', 'boiler', 'hota', 'microunde',
      'вытяжка', 'панель', 'духовой', 'холодильник', 'плита'
    ],
  };

  RecommendationEngine(this.nlpEngine);

  double normalizePriceScore(double price, double minPrice, double maxPrice) {
    if (!price.isFinite) return 0;
    if (!minPrice.isFinite || !maxPrice.isFinite || maxPrice == minPrice) {
      return 100;
    }
    return ((maxPrice - price) / (maxPrice - minPrice)) * 100;
  }

  double normalizeRatingScore(dynamic rating, dynamic reviewCount) {
    final safeRating = _safeDouble(rating);
    final safeReviewCount = _safeDouble(reviewCount);
    final ratingScore = (safeRating / 5) * 100;
    final reviewConfidence = min(safeReviewCount / 100, 1.0);
    return ratingScore * (0.7 + reviewConfidence * 0.3);
  }

  double availabilityScore(bool inStock) {
    return inStock ? 100 : 0;
  }

  int getReviewCount(Product product) {
    return product.reviewCount;
  }

  Map<String, dynamic> calculateProductScore(
      Product product, String searchQuery, Map<String, double> priceRange) {
    final minPrice = priceRange['minPrice'] ?? 0;
    final maxPrice = priceRange['maxPrice'] ?? 0;
    final price = _safeDouble(product.price);
    final rating = _safeDouble(product.rating);
    final reviewCount = getReviewCount(product);

    final priceScore = normalizePriceScore(price, minPrice, maxPrice);
    final ratingScore = normalizeRatingScore(rating, reviewCount);
    final availScore = availabilityScore(product.inStock);

    final nlpAnalysis = nlpEngine.analyzeProduct(product, searchQuery);
    final relevanceScore = _safeDouble(nlpAnalysis['relevanceScore']);

    double sentimentBonus = 0;
    final sentiment = nlpAnalysis['sentiment'] as Map<String, dynamic>? ?? {};
    if (sentiment['label'] == 'positive') {
      sentimentBonus = (_safeDouble(sentiment['confidence'])) * 0.1;
    }

    final reviewScore = min((reviewCount / 500) * 100, 100.0);

    final finalScore = priceScore * weights['price']! +
        ratingScore * weights['rating']! +
        reviewScore * weights['reviews']! +
        availScore * weights['availability']! +
        relevanceScore * weights['relevance']! +
        sentimentBonus;

    return {
      'finalScore': (finalScore.isFinite ? finalScore : 0).round(),
      'breakdown': {
        'price': priceScore.round(),
        'rating': ratingScore.round(),
        'reviews': reviewScore.round(),
        'availability': availScore.round(),
        'relevance': relevanceScore.round(),
        'sentiment': sentiment,
      },
      'nlpAnalysis': nlpAnalysis,
    };
  }

  List<int> extractNumbers(String? text) {
    final matches = RegExp(r'\d+').allMatches(text ?? '');
    return matches.map((m) => int.parse(m.group(0)!)).toList();
  }

  String normalizeText(String? text) {
    return (text ?? '')
        .toLowerCase()
        .replaceAll('\u0103', 'a')
        .replaceAll('\u00e2', 'a')
        .replaceAll('\u00ee', 'i')
        .replaceAll('\u0219', 's')
        .replaceAll('\u015f', 's')
        .replaceAll('\u021b', 't')
        .replaceAll('\u0163', 't');
  }

  List<String> extractQueryTokens(String? text) {
    return normalizeText(text)
        .replaceAll(RegExp(r'[^\p{L}\p{N}\s-]+', unicode: true), ' ')
        .split(RegExp(r'\s+'))
        .map((token) => token.trim())
        .where((token) => token.length >= 2)
        .toList();
  }

  List<String> extractModelCodes(String? text) {
    return extractQueryTokens(text)
        .where((token) =>
            RegExp(r'[a-z]', caseSensitive: false).hasMatch(token) &&
            RegExp(r'\d').hasMatch(token) &&
            token.length >= 2)
        .toList();
  }

  String compactText(String? text) {
    return normalizeText(text).replaceAll(RegExp(r'[^a-z0-9]'), '');
  }

  bool titleContainsModelCode(String productTitle, String modelCode) {
    final compactTitle = compactText(productTitle);
    final compactCode = compactText(modelCode);
    return compactCode.isNotEmpty && compactTitle.contains(compactCode);
  }

  Set<String> detectQueryCategories(String? searchQuery) {
    final query = normalizeText(searchQuery);
    final detected = <String>{};

    for (final entry in categoryKeywords.entries) {
      if (entry.value.any((keyword) => query.contains(normalizeText(keyword)))) {
        detected.add(entry.key);
      }
    }

    // Heuristic: Samsung short model codes are usually phones
    final hasSamsung = query.contains('samsung');
    final modelCodes = extractModelCodes(searchQuery);
    final looksLikeSamsungPhoneModel = modelCodes.any(
        (code) => RegExp(r'^[asfmx]\d{1,3}$', caseSensitive: false).hasMatch(code));
    if (hasSamsung && looksLikeSamsungPhoneModel) {
      detected.add('phone');
    }

    return detected;
  }

  Set<String> productCategoriesFromTitle(String? productTitle) {
    final title = normalizeText(productTitle);
    final categories = <String>{};

    for (final entry in categoryKeywords.entries) {
      if (entry.value.any((keyword) => title.contains(normalizeText(keyword)))) {
        categories.add(entry.key);
      }
    }

    return categories;
  }

  bool matchesQueryCategory(String? productTitle, String? searchQuery) {
    final queryCategories = detectQueryCategories(searchQuery);
    if (queryCategories.isEmpty) return true;

    final productCategories = productCategoriesFromTitle(productTitle);
    if (productCategories.isEmpty) return false;

    return queryCategories.any((category) => productCategories.contains(category));
  }

  bool isAccessory(String? productTitle) {
    const accessoryKeywords = [
      'husa', 'husă', 'huse', 'case', 'cover', 'bumper', 'toc',
      'carcasa', 'carcasă', 'wallet', 'folio',
      'folie', 'folii', 'sticla', 'sticlă', 'protectie', 'protecție', 'glass',
      'tempered glass', 'screen protector', 'privacy glass', 'protector',
      'cablu', 'cabluri', 'cable', 'incarcator', 'charger',
      'încărcător', 'adaptor', 'adapter',
      'casti', 'căști', 'headphones', 'earphones', 'earbuds', 'airpods',
      'suport', 'holder', 'stand', 'mount', 'dock',
      'baterie externa', 'powerbank', 'power bank',
      'stylus', 'pen', 'lens protector',
      'card memorie', 'sd card', 'micro sd',
      'sim card',
      'cleaner', 'curatare',
      'chehol', 'чехол', 'чехлы', 'steklo', 'стекло', 'защитное стекло',
      'zaryadnoe', 'зарядное', 'кабель', 'адаптер', 'держатель'
    ];

    final lowerTitle = normalizeText(productTitle);
    final compactTitle = lowerTitle.replaceAll(RegExp(r'[\s\-_.,/\\]+'), '');

    return accessoryKeywords.any((keyword) {
      final normalizedKeyword = normalizeText(keyword);
      final compactKeyword =
          normalizedKeyword.replaceAll(RegExp(r'[\s\-_.,/\\]+'), '');
      return lowerTitle.contains(normalizedKeyword) ||
          compactTitle.contains(compactKeyword);
    });
  }

  bool matchesModelNumber(String? productTitle, String? searchQuery) {
    final queryNumbers = extractNumbers(searchQuery);
    final titleNumbers = extractNumbers(productTitle);

    if (queryNumbers.isEmpty) return true;

    if (queryNumbers.length == 1 && queryNumbers[0] <= 20) {
      return titleNumbers.contains(queryNumbers[0]);
    }

    final mainQueryNumbers = queryNumbers.where((n) => n <= 20).toList();
    if (mainQueryNumbers.isEmpty) return true;

    return mainQueryNumbers.any((queryNum) => titleNumbers.contains(queryNum));
  }

  bool isRelevantToQuery(String? productTitle, String? searchQuery) {
    final title = normalizeText(productTitle);
    final queryTokens = extractQueryTokens(searchQuery);

    if (queryTokens.isEmpty) return true;

    const stopWords = {
      'de', 'cu', 'si', 'și', 'pentru', 'la', 'din', 'pe', 'in', 'în',
      'the', 'and', 'for', 'pro', 'max', 'mini', 'plus'
    };

    final modelCodes = extractModelCodes(searchQuery);
    if (modelCodes.isNotEmpty) {
      return modelCodes.any((code) => titleContainsModelCode(title, code));
    }

    final meaningfulTokens =
        queryTokens.where((token) => !stopWords.contains(token)).toList();
    if (meaningfulTokens.isEmpty) return true;

    final textTokens =
        meaningfulTokens.where((token) => !RegExp(r'^\d+$').hasMatch(token)).toList();
    final numberTokens =
        meaningfulTokens.where((token) => RegExp(r'^\d+$').hasMatch(token)).toList();

    final textMatchedCount =
        textTokens.where((token) => title.contains(token)).length;
    final matchedCount =
        meaningfulTokens.where((token) => title.contains(token)).length;

    if (textTokens.isNotEmpty && textMatchedCount == 0) {
      return false;
    }

    int requiredMatches;
    if (textTokens.length > 1) {
      requiredMatches = max(2, (textTokens.length * 0.75).ceil());
    } else if (textTokens.length == 1) {
      requiredMatches = 1;
    } else {
      requiredMatches = max(1, (meaningfulTokens.length * 0.5).floor());
    }

    if (matchedCount < requiredMatches) {
      return false;
    }

    final queryContainsBrandOrModel =
        textTokens.length >= 3 || numberTokens.isNotEmpty;
    if (queryContainsBrandOrModel && textTokens.isNotEmpty) {
      final missingImportantTokens =
          textTokens.where((token) => !title.contains(token)).length;
      if (missingImportantTokens > max(1, (textTokens.length * 0.35).floor())) {
        return false;
      }
    }

    const storageSizes = {'32', '64', '128', '256', '512', '1024', '2048'};
    final storageInQuery =
        numberTokens.where((token) => storageSizes.contains(token)).toList();
    if (storageInQuery.isNotEmpty) {
      final hasStorageMatch = storageInQuery.any((size) =>
          RegExp('\\b$size\\s?(gb|гб)?\\b', caseSensitive: false)
              .hasMatch(title));
      if (!hasStorageMatch) {
        return false;
      }
    }

    return true;
  }

  Set<String> get stopWords => {
        'de', 'cu', 'si', 'și', 'sau', 'pentru', 'la', 'din', 'pe', 'in',
        'în', 'the', 'and', 'for', 'pro', 'max', 'mini', 'plus'
      };

  bool passesBasicFilters(Product product, Map<String, dynamic> filters) {
    final maxPrice = filters['maxPrice'];
    if (maxPrice != null && product.price > (maxPrice as num).toDouble()) {
      return false;
    }

    final minRating = filters['minRating'];
    if (minRating != null && product.rating < (minRating as num).toDouble()) {
      return false;
    }

    final inStock = filters['inStock'];
    if (inStock == true && !product.inStock) {
      return false;
    }

    return true;
  }

  bool isRelaxedRelevant(String? productTitle, String? searchQuery) {
    final title = normalizeText(productTitle);
    final tokens = extractQueryTokens(searchQuery);
    if (tokens.isEmpty) return true;

    final modelCodes = extractModelCodes(searchQuery);
    if (modelCodes.isNotEmpty) {
      return modelCodes.any((code) => titleContainsModelCode(title, code));
    }

    final meaningfulTokens = tokens
        .where((token) => token.length >= 2)
        .where((token) => !stopWords.contains(token))
        .toList();
    if (meaningfulTokens.isEmpty) return true;

    final textTokens =
        meaningfulTokens.where((token) => !RegExp(r'^\d+$').hasMatch(token)).toList();
    if (textTokens.isNotEmpty) {
      final matchedTextTokens =
          textTokens.where((token) => title.contains(token)).length;
      final requiredTextMatches = textTokens.length >= 3 ? 2 : 1;
      return matchedTextTokens >= requiredTextMatches;
    }

    return false;
  }

  List<Product> recommendProducts(
      List<Product> products, String searchQuery, Map<String, dynamic> filters) {
    if (products.isEmpty) return [];
    final nonAccessoryProducts =
        products.where((product) => !isAccessory(product.title)).toList();
    final productsToRank =
        nonAccessoryProducts.isNotEmpty ? nonAccessoryProducts : products;

    // Strict filtering
    var strictFilteredProducts = productsToRank.where((product) {
      if (!matchesQueryCategory(product.title, searchQuery)) return false;
      if (!isRelevantToQuery(product.title, searchQuery)) return false;
      if (!matchesModelNumber(product.title, searchQuery)) return false;
      return passesBasicFilters(product, filters);
    }).toList();

    List<Product> filteredProducts;
    if (strictFilteredProducts.isNotEmpty) {
      filteredProducts = strictFilteredProducts;
    } else {
      filteredProducts = productsToRank.where((product) {
        if (!matchesQueryCategory(product.title, searchQuery)) return false;
        if (!isRelaxedRelevant(product.title, searchQuery)) return false;
        return passesBasicFilters(product, filters);
      }).toList();
    }

    // Last-resort fallback
    if (filteredProducts.isEmpty) {
      final modelCodes = extractModelCodes(searchQuery);
      if (modelCodes.isNotEmpty) {
        filteredProducts = productsToRank.where((product) {
          if (!passesBasicFilters(product, filters)) return false;
          final title = product.title;
          return modelCodes.any((code) => titleContainsModelCode(title, code));
        }).toList();
      }
    }

    if (filteredProducts.isEmpty) return [];

    final prices = filteredProducts
        .map((p) => p.price)
        .where((price) => price.isFinite)
        .toList();

    final priceRange = <String, double>{
      'minPrice': prices.isNotEmpty ? prices.reduce(min) : 0,
      'maxPrice': prices.isNotEmpty ? prices.reduce(max) : 0,
    };

    final scoredProducts = filteredProducts.map((product) {
      final scoreData = calculateProductScore(product, searchQuery, priceRange);
      return product.copyWith(
        recommendationScore: scoreData['finalScore'] as int,
        scoreBreakdown: scoreData['breakdown'] as Map<String, dynamic>,
        nlpData: scoreData['nlpAnalysis'] as Map<String, dynamic>,
        reviewCount: getReviewCount(product),
      );
    }).toList();

    final sortBy = (filters['sortBy'] as String?) ?? 'score';
    return sortProducts(scoredProducts, sortBy);
  }

  List<Product> sortProducts(List<Product> products, String sortBy) {
    final sorted = List<Product>.from(products);

    switch (sortBy) {
      case 'price-asc':
        sorted.sort((a, b) => a.price.compareTo(b.price));
        break;
      case 'price-desc':
        sorted.sort((a, b) => b.price.compareTo(a.price));
        break;
      case 'rating':
        sorted.sort((a, b) {
          if (b.rating == a.rating) {
            return getReviewCount(b).compareTo(getReviewCount(a));
          }
          return b.rating.compareTo(a.rating);
        });
        break;
      case 'score':
      default:
        sorted.sort((a, b) =>
            (b.recommendationScore ?? 0).compareTo(a.recommendationScore ?? 0));
        break;
    }

    return sorted;
  }

  List<String> generateExplanation(Product product) {
    final reasons = <String>[];

    if ((product.recommendationScore ?? 0) >= 80) {
      reasons.add('Cel mai bun raport calitate-pret');
    }

    final breakdown = product.scoreBreakdown ?? {};
    if (((breakdown['rating'] as num?)?.toInt() ?? 0) >= 85) {
      reasons.add('Rating excelent (${product.rating} stele)');
    }

    if (getReviewCount(product) > 100) {
      reasons.add('${getReviewCount(product)} recenzii verificate');
    }

    final nlpData = product.nlpData ?? {};
    final sentiment = nlpData['sentiment'] as Map<String, dynamic>? ?? {};
    if (sentiment['label'] == 'positive') {
      reasons.add('Recenzii predominant pozitive');
    }

    if (((breakdown['price'] as num?)?.toInt() ?? 0) >= 70) {
      reasons.add('Pret competitiv');
    }

    final features = nlpData['features'] as Map<String, dynamic>? ?? {};
    if (features.length >= 3) {
      reasons.add('Caracteristici complete');
    }

    return reasons.isNotEmpty ? reasons : ['Produs recomandat'];
  }

  List<Product> findSimilarProducts(
      Product targetProduct, List<Product> allProducts, {int limit = 3}) {
    final similarities = allProducts
        .where((product) => product.id != targetProduct.id)
        .map((product) {
      final titleSim =
          nlpEngine.calculateSimilarity(targetProduct.title, product.title);
      final maxP = max(targetProduct.price, product.price);
      final priceSim = maxP > 0
          ? 1 - (targetProduct.price - product.price).abs() / maxP
          : 1.0;

      return _SimilarityEntry(product, titleSim * 0.7 + priceSim * 0.3);
    }).toList()
      ..sort((a, b) => b.similarity.compareTo(a.similarity));

    return similarities.take(limit).map((e) => e.product).toList();
  }

  double _safeDouble(dynamic value) {
    if (value == null) return 0;
    if (value is double) return value.isFinite ? value : 0;
    if (value is int) return value.toDouble();
    final parsed = double.tryParse(value.toString());
    return (parsed != null && parsed.isFinite) ? parsed : 0;
  }
}

class _SimilarityEntry {
  final Product product;
  final double similarity;
  _SimilarityEntry(this.product, this.similarity);
}
