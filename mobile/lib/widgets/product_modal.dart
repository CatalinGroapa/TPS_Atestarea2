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

  static const Map<String, String> _scoreKeyTranslations = {
    'price': 'Pret',
    'rating': 'Rating',
    'reviews': 'Recenzii',
    'availability': 'Disponibil',
    'relevance': 'Relevanta',
  };

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
      color: Colors.black.withValues(alpha: 0.5),
      child: SafeArea(
        child: Column(
          children: [
            // Close bar
            Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: GestureDetector(
                  onTap: onClose,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.9),
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Icon(Icons.close,
                          color: AppColors.textPrimary, size: 20),
                    ),
                  ),
                ),
              ),
            ),
            // Content
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                  color: AppColors.background,
                  borderRadius:
                      BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
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
                            color: AppColors.surface,
                            child: const Center(
                              child: SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  color: AppColors.textMuted,
                                  strokeWidth: 1.5,
                                ),
                              ),
                            ),
                          ),
                          errorWidget: (_, __, ___) => Container(
                            height: 220,
                            color: AppColors.surface,
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
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: AppColors.surface,
                                    borderRadius:
                                        BorderRadius.circular(8),
                                    border: Border.all(
                                        color: AppColors.borderColor),
                                  ),
                                  child: Text(
                                    product.store.toUpperCase(),
                                    style: const TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  product.title,
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    height: 1.3,
                                    letterSpacing: -0.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                  color: AppColors.borderColor),
                            ),
                            child: Column(
                              children: [
                                const Text(
                                  'Scor',
                                  style: TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 11,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${product.recommendationScore ?? 0}',
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 32,
                                    fontWeight: FontWeight.w800,
                                    fontFeatures: [
                                      FontFeature.tabularFigures()
                                    ],
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
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: List.generate(5, (i) {
                              final rating = product.rating;
                              if (i < rating.floor()) {
                                return const Icon(Icons.star,
                                    size: 16,
                                    color: AppColors.primary);
                              } else if (i < rating.ceil() &&
                                  (rating % 1) >= 0.5) {
                                return const Icon(Icons.star_half,
                                    size: 16,
                                    color: AppColors.primary);
                              }
                              return Icon(Icons.star_border,
                                  size: 16,
                                  color: AppColors.primary
                                      .withValues(alpha: 0.3));
                            }),
                          ),
                          Text(
                            product.rating.toStringAsFixed(1),
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const Text('\u{00B7}',
                              style: TextStyle(
                                  color: AppColors.textMuted)),
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
                                  ? AppColors.primary
                                  : AppColors.surface,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: product.inStock
                                    ? AppColors.primary
                                    : AppColors.borderColor,
                              ),
                            ),
                            child: Text(
                              product.inStock
                                  ? 'In stoc'
                                  : 'Indisponibil',
                              style: TextStyle(
                                color: product.inStock
                                    ? Colors.white
                                    : AppColors.textMuted,
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
                          padding: const EdgeInsets.only(bottom: 24),
                          child: Text(
                            product.description,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 14,
                              height: 1.7,
                            ),
                          ),
                        ),

                      // Technical specs
                      if (product.specs.isNotEmpty) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: AppColors.borderColor),
                          ),
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Specificatii Tehnice',
                                style: TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 12),
                              ...product.specs.map((spec) => Padding(
                                    padding: const EdgeInsets.only(
                                        bottom: 8),
                                    child: Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const Padding(
                                          padding: EdgeInsets.only(
                                              top: 6),
                                          child: Icon(
                                            Icons.circle,
                                            size: 4,
                                            color: AppColors
                                                .textMuted,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            spec,
                                            style: const TextStyle(
                                              color: AppColors
                                                  .textSecondary,
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
                        const SizedBox(height: 16),
                      ],

                      // AI Analysis breakdown
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border:
                              Border.all(color: AppColors.borderColor),
                        ),
                        child: Column(
                          crossAxisAlignment:
                              CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Analiza AI',
                              style: TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 16),
                            GridView.count(
                              crossAxisCount: 2,
                              shrinkWrap: true,
                              physics:
                                  const NeverScrollableScrollPhysics(),
                              crossAxisSpacing: 12,
                              mainAxisSpacing: 12,
                              childAspectRatio: 1.3,
                              children: scoreBreakdown.entries
                                  .where(
                                      (e) => e.key != 'sentiment')
                                  .map((entry) {
                                final value =
                                    (entry.value as num?)
                                            ?.toInt() ??
                                        0;
                                return Container(
                                  padding:
                                      const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: AppColors.background,
                                    borderRadius:
                                        BorderRadius.circular(10),
                                    border: Border.all(
                                        color: AppColors
                                            .borderColor),
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
                                          color: AppColors
                                              .textMuted,
                                          fontSize: 12,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '$value%',
                                        style: const TextStyle(
                                          color: AppColors
                                              .textPrimary,
                                          fontSize: 24,
                                          fontWeight:
                                              FontWeight.w800,
                                          fontFeatures: [
                                            FontFeature
                                                .tabularFigures()
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      ClipRRect(
                                        borderRadius:
                                            BorderRadius.circular(
                                                2),
                                        child:
                                            LinearProgressIndicator(
                                          value: value / 100,
                                          backgroundColor:
                                              AppColors
                                                  .borderColor,
                                          valueColor:
                                              const AlwaysStoppedAnimation(
                                                  AppColors
                                                      .primary),
                                          minHeight: 3,
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
                      const SizedBox(height: 16),

                      // Similar products
                      if (similar.isNotEmpty) ...[
                        const Text(
                          'Produse Similare',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
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
                                  margin: const EdgeInsets.only(
                                      right: 12),
                                  padding:
                                      const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: AppColors.background,
                                    borderRadius:
                                        BorderRadius.circular(12),
                                    border: Border.all(
                                        color: AppColors
                                            .borderColor),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black
                                            .withValues(alpha: 0.04),
                                        blurRadius: 8,
                                        offset:
                                            const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      ClipRRect(
                                        borderRadius:
                                            BorderRadius.circular(
                                                8),
                                        child:
                                            CachedNetworkImage(
                                          imageUrl: p.image,
                                          height: 80,
                                          width: double.infinity,
                                          fit: BoxFit.cover,
                                          errorWidget:
                                              (_, __, ___) =>
                                                  Container(
                                            height: 80,
                                            color: AppColors
                                                .surface,
                                            child: const Icon(
                                                Icons
                                                    .image_not_supported,
                                                color: AppColors
                                                    .textMuted),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        p.store.toUpperCase(),
                                        style: const TextStyle(
                                          color:
                                              AppColors.textMuted,
                                          fontSize: 10,
                                          letterSpacing: 0.8,
                                          fontWeight:
                                              FontWeight.w600,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Expanded(
                                        child: Text(
                                          p.title,
                                          maxLines: 2,
                                          overflow: TextOverflow
                                              .ellipsis,
                                          style: const TextStyle(
                                            color: AppColors
                                                .textPrimary,
                                            fontSize: 12,
                                            height: 1.3,
                                          ),
                                        ),
                                      ),
                                      Text(
                                        formatPrice(p.price),
                                        style: const TextStyle(
                                          color: AppColors
                                              .textPrimary,
                                          fontSize: 14,
                                          fontWeight:
                                              FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Price + open in store button
                      Container(
                        padding: const EdgeInsets.only(top: 16),
                        decoration: const BoxDecoration(
                          border: Border(
                            top: BorderSide(
                                color: AppColors.borderColor),
                          ),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Container(
                                padding:
                                    const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius:
                                      BorderRadius.circular(12),
                                  border: Border.all(
                                      color:
                                          AppColors.borderColor),
                                ),
                                child: Column(
                                  children: [
                                    const Text(
                                      'Pret',
                                      style: TextStyle(
                                        color: AppColors
                                            .textMuted,
                                        fontSize: 12,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      formatPrice(product.price)
                                          .replaceAll(
                                              ' MDL', ''),
                                      style: const TextStyle(
                                        color: AppColors
                                            .textPrimary,
                                        fontSize: 24,
                                        fontWeight:
                                            FontWeight.w800,
                                        fontFeatures: [
                                          FontFeature
                                              .tabularFigures()
                                        ],
                                      ),
                                    ),
                                    const Text(
                                      'MDL',
                                      style: TextStyle(
                                        color: AppColors
                                            .textMuted,
                                        fontSize: 12,
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
                                  padding:
                                      const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    borderRadius:
                                        BorderRadius.circular(
                                            12),
                                  ),
                                  child: Center(
                                    child: Text(
                                      'Vezi in ${product.store}',
                                      textAlign:
                                          TextAlign.center,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                        fontWeight:
                                            FontWeight.w600,
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
