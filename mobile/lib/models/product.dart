class Product {
  final String id;
  final String title;
  final String description;
  final String store;
  final String storeUrl;
  final String productUrl;
  final String image;
  final double price;
  final double rating;
  final int reviewCount;
  final bool inStock;
  final List<String> reviews;
  final List<String> specs;
  int? recommendationScore;
  Map<String, dynamic>? scoreBreakdown;
  Map<String, dynamic>? nlpData;

  Product({
    required this.id,
    required this.title,
    this.description = '',
    this.store = 'Magazin',
    this.storeUrl = '',
    this.productUrl = '',
    this.image = '',
    this.price = 0,
    this.rating = 0,
    this.reviewCount = 0,
    this.inStock = false,
    this.reviews = const [],
    this.specs = const [],
    this.recommendationScore,
    this.scoreBreakdown,
    this.nlpData,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    final safePrice = _toDouble(json['price']);
    final safeRating = _toDouble(json['rating']);

    // reviewCount can come as json['reviewCount'] or json['reviews'] (if int)
    int reviewCount = 0;
    if (json['reviewCount'] != null) {
      reviewCount = _toInt(json['reviewCount']);
    } else if (json['reviews'] is int) {
      reviewCount = json['reviews'] as int;
    } else if (json['reviews'] is String) {
      reviewCount = int.tryParse(json['reviews'] as String) ?? 0;
    }

    List<String> reviews = [];
    if (json['reviews'] is List) {
      reviews = (json['reviews'] as List)
          .map((e) => e?.toString() ?? '')
          .toList();
    }

    List<String> specs = [];
    if (json['specs'] is List) {
      specs = (json['specs'] as List)
          .map((e) => e?.toString() ?? '')
          .toList();
    }

    final sourceStore = (json['store'] ?? 'Magazin').toString();
    final cleanStore = sourceStore.replaceAll(RegExp(r'\.md$', caseSensitive: false), '');

    return Product(
      id: json['id']?.toString() ?? '${cleanStore}_${DateTime.now().millisecondsSinceEpoch}',
      title: json['title']?.toString() ?? 'Produs fara titlu',
      description: json['description']?.toString() ?? json['title']?.toString() ?? '',
      store: cleanStore,
      storeUrl: json['storeUrl']?.toString() ?? '',
      productUrl: json['productUrl']?.toString() ??
          json['link']?.toString() ??
          json['storeUrl']?.toString() ??
          '',
      image: json['image']?.toString() ??
          'https://via.placeholder.com/400x300/1e293b/6366f1?text=Produs',
      price: safePrice,
      rating: safeRating,
      reviewCount: reviewCount,
      inStock: json['inStock'] == true,
      reviews: reviews,
      specs: specs,
    );
  }

  Product copyWith({
    String? id,
    String? title,
    String? description,
    String? store,
    String? storeUrl,
    String? productUrl,
    String? image,
    double? price,
    double? rating,
    int? reviewCount,
    bool? inStock,
    List<String>? reviews,
    List<String>? specs,
    int? recommendationScore,
    Map<String, dynamic>? scoreBreakdown,
    Map<String, dynamic>? nlpData,
  }) {
    return Product(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      store: store ?? this.store,
      storeUrl: storeUrl ?? this.storeUrl,
      productUrl: productUrl ?? this.productUrl,
      image: image ?? this.image,
      price: price ?? this.price,
      rating: rating ?? this.rating,
      reviewCount: reviewCount ?? this.reviewCount,
      inStock: inStock ?? this.inStock,
      reviews: reviews ?? this.reviews,
      specs: specs ?? this.specs,
      recommendationScore: recommendationScore ?? this.recommendationScore,
      scoreBreakdown: scoreBreakdown ?? this.scoreBreakdown,
      nlpData: nlpData ?? this.nlpData,
    );
  }

  static double _toDouble(dynamic value) {
    if (value == null) return 0;
    if (value is double) return value.isFinite ? value : 0;
    if (value is int) return value.toDouble();
    final parsed = double.tryParse(value.toString());
    return (parsed != null && parsed.isFinite) ? parsed : 0;
  }

  static int _toInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is double) return value.isFinite ? value.toInt() : 0;
    return int.tryParse(value.toString()) ?? 0;
  }
}

class WishlistItem {
  final String id;
  final String title;
  final double price;
  final String image;
  final String store;
  final String productUrl;
  final String addedAt;

  WishlistItem({
    required this.id,
    required this.title,
    this.price = 0,
    this.image = '',
    this.store = '',
    this.productUrl = '',
    String? addedAt,
  }) : addedAt = addedAt ?? DateTime.now().toIso8601String();

  factory WishlistItem.fromJson(Map<String, dynamic> json) {
    return WishlistItem(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      price: Product._toDouble(json['price']),
      image: json['image']?.toString() ?? '',
      store: json['store']?.toString() ?? '',
      productUrl: json['productUrl']?.toString() ??
          json['link']?.toString() ??
          json['storeUrl']?.toString() ??
          '',
      addedAt: json['addedAt']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'price': price,
      'image': image,
      'store': store,
      'productUrl': productUrl,
      'addedAt': addedAt,
    };
  }

  factory WishlistItem.fromProduct(Product product) {
    return WishlistItem(
      id: product.id,
      title: product.title,
      price: product.price,
      image: product.image,
      store: product.store,
      productUrl: product.productUrl.isNotEmpty
          ? product.productUrl
          : product.storeUrl,
    );
  }
}
