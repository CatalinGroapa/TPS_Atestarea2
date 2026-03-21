import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../models/product.dart';

class ProductCard extends StatelessWidget {
  final Product product;
  final int rank;
  final bool isWishlisted;
  final List<String> reasons;
  final String Function(double) formatPrice;
  final VoidCallback onDetailsClick;
  final VoidCallback onWishlistToggle;

  const ProductCard({
    super.key,
    required this.product,
    required this.rank,
    required this.isWishlisted,
    required this.reasons,
    required this.formatPrice,
    required this.onDetailsClick,
    required this.onWishlistToggle,
  });

  static const Map<String, String> storeEmoji = {
    'Darwin': '\u{1F98E}',
    'Cactus': '\u{1F335}',
    'Bomba': '\u{1F4A3}',
    'PandaShop': '\u{1F43C}',
  };

  Color get _scoreColor {
    final score = product.recommendationScore ?? 0;
    if (score >= 80) return AppColors.success;
    if (score >= 60) return AppColors.warning;
    return AppColors.primary;
  }

  String _generateStars(double rating) {
    final fullStars = rating.floor();
    final hasHalf = (rating % 1) >= 0.5;
    final empty = 5 - fullStars - (hasHalf ? 1 : 0);
    return '\u2B50' * fullStars +
        (hasHalf ? '\u2728' : '') +
        '\u2606' * empty;
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppColors.cardBg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.borderColor),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onDetailsClick,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image with score badge and wishlist button
            Stack(
              children: [
                CachedNetworkImage(
                  imageUrl: product.image,
                  height: 120,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(
                    height: 120,
                    color: AppColors.surface,
                    child: const Center(
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  errorWidget: (_, __, ___) => Container(
                    height: 120,
                    color: AppColors.surface,
                    child: const Center(
                      child: Icon(Icons.image_not_supported,
                          color: AppColors.textMuted, size: 32),
                    ),
                  ),
                ),
                // Score badge
                Positioned(
                  top: 8,
                  left: 8,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _scoreColor,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '\u{1F3C6} #$rank',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '${product.recommendationScore ?? 0}/100',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                // Wishlist button
                Positioned(
                  top: 8,
                  right: 8,
                  child: GestureDetector(
                    onTap: onWishlistToggle,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppColors.background.withValues(alpha: 0.7),
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        isWishlisted ? '\u2764\uFE0F' : '\u{1F90D}',
                        style: const TextStyle(fontSize: 16),
                      ),
                    ),
                  ),
                ),
              ],
            ),

            // Content
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Store name
                    Text(
                      '${storeEmoji[product.store] ?? '\u{1F3EA}'} ${product.store}',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    // Title
                    Text(
                      product.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 4),
                    // Rating
                    Row(
                      children: [
                        Text(
                          _generateStars(product.rating),
                          style: const TextStyle(fontSize: 10),
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            '${product.rating.toStringAsFixed(1)} (${product.reviewCount})',
                            style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 10,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    // Feature tags
                    if (reasons.isNotEmpty)
                      Wrap(
                        spacing: 4,
                        runSpacing: 2,
                        children: reasons.take(2).map((reason) {
                          return Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              '\u2713 $reason',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontSize: 9,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          );
                        }).toList(),
                      ),
                    // Stock status
                    if (!product.inStock)
                      const Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: Text(
                          '\u26A0\uFE0F Indisponibil',
                          style: TextStyle(
                            color: AppColors.danger,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    const Spacer(),
                    // Price and details button
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Pret',
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 10,
                                ),
                              ),
                              Text(
                                formatPrice(product.price),
                                style: const TextStyle(
                                  color: AppColors.success,
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        GestureDetector(
                          onTap: onDetailsClick,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'Detalii \u2192',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
