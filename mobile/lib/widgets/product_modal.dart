import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/theme.dart';
import '../models/product.dart';
import '../engines/recommendation_engine.dart';

class ProductModal extends StatelessWidget {
  final Product product;
  final List<Product> allProducts;
  final RecommendationEngine recommendationEngine;
  final String Function(double) formatPrice;
  final List<WishlistItem> wishlist;
  final VoidCallback onWishlistToggle;
  final void Function(Product) onSimilarClick;
  final VoidCallback onClose;

  const ProductModal({
    super.key,
    required this.product,
    required this.allProducts,
    required this.recommendationEngine,
    required this.formatPrice,
    required this.wishlist,
    required this.onWishlistToggle,
    required this.onSimilarClick,
    required this.onClose,
  });

  static const Map<String, String> storeEmoji = {
    'Darwin': '\u{1F98E}',
    'Cactus': '\u{1F335}',
    'Bomba': '\u{1F4A3}',
    'PandaShop': '\u{1F43C}',
  };

  static const Map<String, String> _scoreKeyTranslations = {
    'price': 'Pret',
    'rating': 'Rating',
    'reviews': 'Recenzii',
    'availability': 'Disponibil',
    'relevance': 'Relevanta',
  };

  String _generateStars(double rating) {
    final fullStars = rating.floor();
    final hasHalf = (rating % 1) >= 0.5;
    final empty = 5 - fullStars - (hasHalf ? 1 : 0);
    return '\u2B50' * fullStars +
        (hasHalf ? '\u2728' : '') +
        '\u2606' * empty;
  }

  Color _scoreValueColor(int value) {
    if (value >= 70) return AppColors.success;
    if (value >= 50) return AppColors.warning;
    return AppColors.danger;
  }

  Future<void> _openUrl(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final similar =
        recommendationEngine.findSimilarProducts(product, allProducts);
    final scoreBreakdown = product.scoreBreakdown ??
        {
          'price': 0,
          'rating': 0,
          'reviews': 0,
          'availability': product.inStock ? 100 : 0,
          'relevance': 0,
        };

    return Material(
      color: Colors.black54,
      child: SafeArea(
        child: Column(
          children: [
            // Close bar
            Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: IconButton(
                  onPressed: onClose,
                  icon: const Icon(Icons.close, color: Colors.white, size: 28),
                ),
              ),
            ),
            // Content
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Product image
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: CachedNetworkImage(
                          imageUrl: product.image,
                          height: 220,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(
                            height: 220,
                            color: AppColors.background,
                            child: const Center(
                              child: CircularProgressIndicator(
                                  color: AppColors.primary),
                            ),
                          ),
                          errorWidget: (_, __, ___) => Container(
                            height: 220,
                            color: AppColors.background,
                            child: const Center(
                              child: Icon(Icons.image_not_supported,
                                  color: AppColors.textMuted, size: 48),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Store badge + AI score
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: AppColors.background,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    '${storeEmoji[product.store] ?? '\u{1F3EA}'} ${product.store}',
                                    style: const TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  product.title,
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    height: 1.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.background,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              children: [
                                const Text(
                                  'Scor AI',
                                  style: TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 12,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${product.recommendationScore ?? 0}',
                                  style: const TextStyle(
                                    color: AppColors.success,
                                    fontSize: 32,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const Text(
                                  'din 100',
                                  style: TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Rating, reviews, stock
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            _generateStars(product.rating),
                            style: const TextStyle(fontSize: 16),
                          ),
                          Text(
                            product.rating.toStringAsFixed(1),
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const Text('\u2022',
                              style:
                                  TextStyle(color: AppColors.textMuted)),
                          Text(
                            '${product.reviewCount} recenzii',
                            style: const TextStyle(
                                color: AppColors.textSecondary),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: product.inStock
                                  ? AppColors.success
                                  : AppColors.danger,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              product.inStock
                                  ? '\u2713 In stoc'
                                  : '\u2717 Indisponibil',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Description
                      if (product.description.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 20),
                          child: Text(
                            product.description,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 14,
                              height: 1.8,
                            ),
                          ),
                        ),

                      // Technical specs
                      if (product.specs.isNotEmpty) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.background,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Row(
                                children: [
                                  Text('\u2699\uFE0F',
                                      style: TextStyle(fontSize: 16)),
                                  SizedBox(width: 8),
                                  Text(
                                    'Specificatii Tehnice',
                                    style: TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              ...product.specs.map((spec) => Padding(
                                    padding:
                                        const EdgeInsets.only(bottom: 8),
                                    child: Row(
                                      children: [
                                        const Text(
                                          '\u25AA',
                                          style: TextStyle(
                                              color: AppColors.primary),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            spec,
                                            style: const TextStyle(
                                              color:
                                                  AppColors.textSecondary,
                                              fontSize: 14,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  )),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // AI Analysis breakdown
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Text('\u{1F916}',
                                    style: TextStyle(fontSize: 16)),
                                SizedBox(width: 8),
                                Text(
                                  'Analiza AI',
                                  style: TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            GridView.count(
                              crossAxisCount: 2,
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              crossAxisSpacing: 12,
                              mainAxisSpacing: 12,
                              childAspectRatio: 1.3,
                              children: scoreBreakdown.entries
                                  .where((e) => e.key != 'sentiment')
                                  .map((entry) {
                                final value =
                                    (entry.value as num?)?.toInt() ?? 0;
                                final color = _scoreValueColor(value);
                                return Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: AppColors.surface,
                                    borderRadius:
                                        BorderRadius.circular(10),
                                  ),
                                  child: Column(
                                    mainAxisAlignment:
                                        MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        _scoreKeyTranslations[
                                                entry.key] ??
                                            entry.key,
                                        style: const TextStyle(
                                          color:
                                              AppColors.textSecondary,
                                          fontSize: 12,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '$value%',
                                        style: TextStyle(
                                          color: color,
                                          fontSize: 24,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      ClipRRect(
                                        borderRadius:
                                            BorderRadius.circular(3),
                                        child: LinearProgressIndicator(
                                          value: value / 100,
                                          backgroundColor:
                                              AppColors.background,
                                          valueColor:
                                              AlwaysStoppedAnimation(
                                                  color),
                                          minHeight: 6,
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }).toList(),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Similar products
                      if (similar.isNotEmpty) ...[
                        const Row(
                          children: [
                            Text('\u{1F517}',
                                style: TextStyle(fontSize: 16)),
                            SizedBox(width: 8),
                            Text(
                              'Produse Similare',
                              style: TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 200,
                          child: ListView.builder(
                            scrollDirection: Axis.horizontal,
                            itemCount: similar.length,
                            itemBuilder: (context, index) {
                              final p = similar[index];
                              return GestureDetector(
                                onTap: () => onSimilarClick(p),
                                child: Container(
                                  width: 160,
                                  margin:
                                      const EdgeInsets.only(right: 12),
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: AppColors.background,
                                    borderRadius:
                                        BorderRadius.circular(10),
                                    border: Border.all(
                                        color: AppColors.borderColor),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      ClipRRect(
                                        borderRadius:
                                            BorderRadius.circular(8),
                                        child: CachedNetworkImage(
                                          imageUrl: p.image,
                                          height: 80,
                                          width: double.infinity,
                                          fit: BoxFit.cover,
                                          errorWidget:
                                              (_, __, ___) =>
                                                  Container(
                                            height: 80,
                                            color: AppColors.surface,
                                            child: const Icon(
                                                Icons
                                                    .image_not_supported,
                                                color: AppColors
                                                    .textMuted),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        '${storeEmoji[p.store] ?? '\u{1F3EA}'} ${p.store}',
                                        style: const TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 10,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Expanded(
                                        child: Text(
                                          p.title,
                                          maxLines: 2,
                                          overflow:
                                              TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color:
                                                AppColors.textPrimary,
                                            fontSize: 12,
                                            height: 1.3,
                                          ),
                                        ),
                                      ),
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment
                                                .spaceBetween,
                                        children: [
                                          Text(
                                            formatPrice(p.price),
                                            style: const TextStyle(
                                              color: AppColors.success,
                                              fontSize: 13,
                                              fontWeight:
                                                  FontWeight.bold,
                                            ),
                                          ),
                                          Text(
                                            _generateStars(p.rating),
                                            style: const TextStyle(
                                                fontSize: 8),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // Price + open in store button
                      Container(
                        padding: const EdgeInsets.only(top: 16),
                        decoration: const BoxDecoration(
                          border: Border(
                            top: BorderSide(
                                color: AppColors.borderColor, width: 2),
                          ),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: AppColors.background,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Column(
                                  children: [
                                    const Text(
                                      'Pret',
                                      style: TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 13,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      formatPrice(product.price),
                                      style: const TextStyle(
                                        color: AppColors.success,
                                        fontSize: 24,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const Text(
                                      'Lei moldovenesti',
                                      style: TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => _openUrl(
                                    product.productUrl.isNotEmpty
                                        ? product.productUrl
                                        : product.storeUrl),
                                child: Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [
                                        AppColors.primary,
                                        AppColors.secondary
                                      ],
                                    ),
                                    borderRadius:
                                        BorderRadius.circular(12),
                                  ),
                                  child: Center(
                                    child: Text(
                                      '${storeEmoji[product.store] ?? '\u{1F3EA}'} Vezi in ${product.store} \u2192',
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
