import 'dart:math';
import '../models/product.dart';

class NLPEngine {
  final Set<String> stopWords = {
    'si', 'și', 'de', 'la', 'in', 'în', 'cu', 'pe', 'pentru', 'cel', 'cea', 'mai',
    'un', 'o', 'sau', 'dar', 'ca', 'că', 'este', 'sunt', 'foarte', 'din', 'care'
  };

  final Map<String, List<String>> sentimentKeywords = {
    'positive': [
      'excelent', 'bun', 'foarte bun', 'perfect', 'recomandat', 'calitate',
      'performant', 'rapid', 'rezistent', 'eficient', 'minunat', 'super',
      'excellent', 'good', 'great', 'amazing', 'recommended', 'quality'
    ],
    'negative': [
      'slab', 'prost', 'defect', 'problema', 'probleme', 'dezamăgit',
      'scump', 'ieftin', 'spart', 'stricat', 'rău', 'bad', 'poor',
      'terrible', 'broken', 'disappointing', 'expensive'
    ],
  };

  final Map<String, List<String>> featureKeywords = {
    'performance': ['rapid', 'performant', 'viteza', 'putere', 'procesor', 'ram', 'ghz', 'performance', 'fast', 'speed'],
    'quality': ['calitate', 'rezistent', 'durabil', 'premium', 'solid', 'quality', 'durable', 'premium'],
    'design': ['design', 'aspect', 'elegant', 'modern', 'frumos', 'beautiful', 'elegant', 'modern'],
    'price': ['pret', 'preț', 'valoare', 'ieftin', 'scump', 'cost', 'price', 'value', 'cheap', 'expensive'],
    'battery': ['baterie', 'autonomie', 'durata', 'battery', 'life', 'charging'],
    'screen': ['ecran', 'display', 'rezolutie', 'rezoluție', 'screen', 'display', 'resolution'],
  };

  /// Tokenize and clean text
  List<String> tokenize(String? text) {
    if (text == null || text.isEmpty) return [];

    return text
        .toLowerCase()
        .replaceAll(RegExp(r'[^\w\săâîșț]'), ' ')
        .split(RegExp(r'\s+'))
        .where((word) => word.length > 2 && !stopWords.contains(word))
        .toList();
  }

  /// Extract keywords from text
  List<String> extractKeywords(String? text, {int maxKeywords = 10}) {
    final tokens = tokenize(text);
    final frequency = <String, int>{};

    for (final token in tokens) {
      frequency[token] = (frequency[token] ?? 0) + 1;
    }

    final entries = frequency.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return entries
        .take(maxKeywords)
        .map((e) => e.key)
        .toList();
  }

  /// Analyze sentiment for reviews
  Map<String, dynamic> analyzeSentiment(String? text) {
    if (text == null || text.isEmpty) {
      return {'score': 0, 'label': 'neutral', 'confidence': 0.0};
    }

    final tokens = tokenize(text);
    int positiveScore = 0;
    int negativeScore = 0;

    for (final token in tokens) {
      if (sentimentKeywords['positive']!.any((word) => token.contains(word))) {
        positiveScore++;
      }
      if (sentimentKeywords['negative']!.any((word) => token.contains(word))) {
        negativeScore++;
      }
    }

    final totalScore = positiveScore - negativeScore;
    String label = 'neutral';

    if (totalScore > 0) {
      label = 'positive';
    } else if (totalScore < 0) {
      label = 'negative';
    }

    final confidence = tokens.isEmpty
        ? 0.0
        : min((totalScore.abs() / tokens.length) * 100, 100.0);

    return {
      'score': totalScore,
      'label': label,
      'confidence': confidence,
    };
  }

  /// Extract mentioned features from description/reviews
  Map<String, int> extractFeatures(String? text) {
    final tokens = tokenize(text);
    final mentionedFeatures = <String, int>{};

    for (final entry in featureKeywords.entries) {
      final mentions = tokens.where((token) =>
          entry.value.any((keyword) => token.contains(keyword))).length;

      if (mentions > 0) {
        mentionedFeatures[entry.key] = mentions;
      }
    }

    return mentionedFeatures;
  }

  /// Calculate similarity between two texts (simplified Cosine Similarity)
  double calculateSimilarity(String? text1, String? text2) {
    final tokens1 = tokenize(text1).toSet();
    final tokens2 = tokenize(text2).toSet();

    final intersection = tokens1.intersection(tokens2);

    if (tokens1.isEmpty || tokens2.isEmpty) return 0;

    return (intersection.length * 2) / (tokens1.length + tokens2.length);
  }

  /// Complete product analysis
  Map<String, dynamic> analyzeProduct(Product product, String searchQuery) {
    final titleKeywords = extractKeywords(product.title);
    final descKeywords = extractKeywords(product.description);

    // Similarity with search query
    final titleSimilarity = calculateSimilarity(product.title, searchQuery);
    final descSimilarity = calculateSimilarity(product.description, searchQuery);

    // Sentiment analysis from reviews
    Map<String, dynamic> sentimentAnalysis = {'positive': 0, 'negative': 0, 'neutral': 1, 'label': 'neutral', 'confidence': 0.0, 'score': 0};
    if (product.reviews.isNotEmpty) {
      final reviewTexts = product.reviews.join(' ');
      sentimentAnalysis = analyzeSentiment(reviewTexts);
    }

    // Extract features
    final reviewsText = product.reviews.join(' ');
    final features = extractFeatures(
        '${product.title} ${product.description} $reviewsText');

    // Combine keywords (unique)
    final allKeywords = <String>{...titleKeywords, ...descKeywords}.toList();

    return {
      'keywords': allKeywords,
      'titleSimilarity': titleSimilarity,
      'descSimilarity': descSimilarity,
      'overallSimilarity': (titleSimilarity * 0.7 + descSimilarity * 0.3),
      'sentiment': sentimentAnalysis,
      'features': features,
      'relevanceScore': calculateRelevanceScore({
        'titleSimilarity': titleSimilarity,
        'descSimilarity': descSimilarity,
        'sentiment': sentimentAnalysis,
      }),
    };
  }

  /// Calculate relevance score
  double calculateRelevanceScore(Map<String, dynamic> analysis) {
    final titleSimilarity = (analysis['titleSimilarity'] as num?)?.toDouble() ?? 0.0;
    final descSimilarity = (analysis['descSimilarity'] as num?)?.toDouble() ?? 0.0;
    final sentiment = analysis['sentiment'] as Map<String, dynamic>? ?? {};

    double score = (titleSimilarity * 0.5 + descSimilarity * 0.2) * 100;

    // Bonus for positive sentiment
    if (sentiment['label'] == 'positive') {
      score += ((sentiment['confidence'] as num?)?.toDouble() ?? 0.0) * 0.3;
    } else if (sentiment['label'] == 'negative') {
      score -= ((sentiment['confidence'] as num?)?.toDouble() ?? 0.0) * 0.2;
    }

    return max(0, min(100, score));
  }

  /// Search query enhancement suggestions
  Map<String, dynamic> enhanceSearchQuery(String query) {
    final keywords = extractKeywords(query);
    final enhanced = <String, dynamic>{
      'original': query,
      'keywords': keywords,
      'suggestions': <String>[],
    };

    final synonyms = <String, List<String>>{
      'laptop': ['notebook', 'ultrabook', 'calculator portabil'],
      'telefon': ['smartphone', 'mobile', 'telefon mobil'],
      'casti': ['căști', 'headphones', 'earbuds', 'earphones'],
      'tv': ['televizor', 'smart tv', 'led tv'],
      'tableta': ['tabletă', 'tablet', 'ipad'],
    };

    for (final keyword in keywords) {
      if (synonyms.containsKey(keyword)) {
        (enhanced['suggestions'] as List<String>).addAll(synonyms[keyword]!);
      }
    }

    return enhanced;
  }
}
