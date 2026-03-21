import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/theme.dart';
import '../models/product.dart';

class WishlistModal extends StatelessWidget {
  final List<WishlistItem> wishlist;
  final String Function(double) formatPrice;
  final VoidCallback onClose;
  final void Function(WishlistItem) onRemove;
  final VoidCallback onClearAll;

  const WishlistModal({
    super.key,
    required this.wishlist,
    required this.formatPrice,
    required this.onClose,
    required this.onRemove,
    required this.onClearAll,
  });

  Future<void> _openUrl(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
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
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Favorite (${wishlist.length})',
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 16),

                      if (wishlist.isEmpty)
                        const Expanded(
                          child: Center(
                            child: Text(
                              'Nu ai produse in lista de favorite',
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 15,
                              ),
                            ),
                          ),
                        )
                      else
                        Expanded(
                          child: ListView.builder(
                            itemCount: wishlist.length,
                            itemBuilder: (context, index) {
                              final item = wishlist[index];
                              return Container(
                                margin:
                                    const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppColors.background,
                                  borderRadius:
                                      BorderRadius.circular(12),
                                  border: Border.all(
                                      color: AppColors.borderColor),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.04),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  children: [
                                    ClipRRect(
                                      borderRadius:
                                          BorderRadius.circular(8),
                                      child: CachedNetworkImage(
                                        imageUrl: item.image,
                                        width: 64,
                                        height: 64,
                                        fit: BoxFit.contain,
                                        placeholder: (_, __) =>
                                            Container(
                                          width: 64,
                                          height: 64,
                                          color: AppColors.surface,
                                        ),
                                        errorWidget:
                                            (_, __, ___) =>
                                                Container(
                                          width: 64,
                                          height: 64,
                                          color: AppColors.surface,
                                          child: const Icon(
                                            Icons
                                                .image_not_supported,
                                            color:
                                                AppColors.textMuted,
                                            size: 20,
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment
                                                .start,
                                        children: [
                                          Text(
                                            item.title,
                                            maxLines: 2,
                                            overflow: TextOverflow
                                                .ellipsis,
                                            style: const TextStyle(
                                              color: AppColors
                                                  .textPrimary,
                                              fontSize: 14,
                                              fontWeight:
                                                  FontWeight.w600,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            item.store
                                                .toUpperCase(),
                                            style: const TextStyle(
                                              color: AppColors
                                                  .textMuted,
                                              fontSize: 11,
                                              letterSpacing: 0.8,
                                              fontWeight:
                                                  FontWeight.w600,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            formatPrice(item.price),
                                            style: const TextStyle(
                                              color: AppColors
                                                  .textPrimary,
                                              fontSize: 15,
                                              fontWeight:
                                                  FontWeight.w700,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Column(
                                      children: [
                                        SizedBox(
                                          width: 80,
                                          child: GestureDetector(
                                            onTap: () =>
                                                _openUrl(item
                                                    .productUrl),
                                            child: Container(
                                              padding:
                                                  const EdgeInsets
                                                      .symmetric(
                                                      vertical: 8),
                                              decoration:
                                                  BoxDecoration(
                                                color: AppColors
                                                    .primary,
                                                borderRadius:
                                                    BorderRadius
                                                        .circular(
                                                            8),
                                              ),
                                              child: const Center(
                                                child: Text(
                                                  'Produs',
                                                  style: TextStyle(
                                                    color: Colors
                                                        .white,
                                                    fontSize: 12,
                                                    fontWeight:
                                                        FontWeight
                                                            .w600,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        SizedBox(
                                          width: 80,
                                          child: GestureDetector(
                                            onTap: () =>
                                                onRemove(item),
                                            child: Container(
                                              padding:
                                                  const EdgeInsets
                                                      .symmetric(
                                                      vertical: 8),
                                              decoration:
                                                  BoxDecoration(
                                                borderRadius:
                                                    BorderRadius
                                                        .circular(
                                                            8),
                                                border: Border.all(
                                                    color: AppColors
                                                        .borderColor),
                                              ),
                                              child: const Center(
                                                child: Text(
                                                  'Elimina',
                                                  style: TextStyle(
                                                    color: AppColors
                                                        .textMuted,
                                                    fontSize: 12,
                                                    fontWeight:
                                                        FontWeight
                                                            .w600,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),

                      if (wishlist.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: SizedBox(
                            width: double.infinity,
                            child: GestureDetector(
                              onTap: () {
                                showDialog(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    backgroundColor:
                                        AppColors.background,
                                    shape: RoundedRectangleBorder(
                                      borderRadius:
                                          BorderRadius.circular(16),
                                    ),
                                    title: const Text(
                                      'Confirmare',
                                      style: TextStyle(
                                          color: AppColors
                                              .textPrimary),
                                    ),
                                    content: const Text(
                                      'Stergi toate produsele din favorite?',
                                      style: TextStyle(
                                          color: AppColors
                                              .textSecondary),
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.of(ctx)
                                                .pop(),
                                        child: const Text(
                                          'Anuleaza',
                                          style: TextStyle(
                                              color: AppColors
                                                  .textSecondary),
                                        ),
                                      ),
                                      TextButton(
                                        onPressed: () {
                                          Navigator.of(ctx).pop();
                                          onClearAll();
                                        },
                                        child: const Text(
                                          'Sterge',
                                          style: TextStyle(
                                              color: AppColors
                                                  .textPrimary,
                                              fontWeight:
                                                  FontWeight.w600),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    vertical: 14),
                                decoration: BoxDecoration(
                                  borderRadius:
                                      BorderRadius.circular(10),
                                  border: Border.all(
                                      color: AppColors.borderColor),
                                ),
                                child: const Center(
                                  child: Text(
                                    'Sterge toate favoritele',
                                    style: TextStyle(
                                      color:
                                          AppColors.textSecondary,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ),
                            ),
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
