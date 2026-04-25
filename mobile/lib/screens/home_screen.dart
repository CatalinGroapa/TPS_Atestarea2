import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../config/theme.dart';
import '../models/product.dart';
import '../engines/nlp_engine.dart';
import '../engines/recommendation_engine.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../widgets/search_bar_widget.dart';
import '../widgets/filters_toolbar.dart';
import '../widgets/product_card.dart';
import '../widgets/product_modal.dart';
import '../widgets/wishlist_modal.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  final User user;
  const HomeScreen({super.key, required this.user});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const bool _quickCompareBetaEnabled = true;

  late final NLPEngine _nlpEngine;
  late final RecommendationEngine _recommendationEngine;
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();

  String _query = '';
  List<Product> _products = [];
  List<Product> _scoredResults = [];
  Map<String, dynamic> _filters = {
    'minPrice': null,
    'maxPrice': null,
    'inStock': false,
    'sortBy': 'score',
  };
  bool _loading = false;
  List<Map<String, dynamic>> _searchHistory = [];
  List<WishlistItem> _wishlist = [];
  Product? _selectedProduct;
  bool _showWishlist = false;
  bool _showQuickCompare = false;
  bool _loadingQuickCompareMeta = false;
  final List<String> _compareProductIds = [];
  final Map<String, Map<String, dynamic>> _compareProductMetaById = {};
  String? _emptyState = 'welcome';

  @override
  void initState() {
    super.initState();
    _nlpEngine = NLPEngine();
    _recommendationEngine = RecommendationEngine(_nlpEngine);
    _loadPersistedData();
  }

  Future<void> _loadPersistedData() async {
    final wishlist = await _storageService.loadWishlist();
    final history = await _storageService.loadSearchHistory();
    if (mounted) {
      setState(() {
        _wishlist = wishlist;
        _searchHistory = history;
      });
    }
  }

  String formatPrice(double price) {
    final safePrice = price.isFinite ? price : 0.0;
    final formatted = safePrice.toStringAsFixed(0).replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
    return '$formatted MDL';
  }

  Product _normalizeProduct(Product product, int index) {
    return product.copyWith(
      id: product.id.isNotEmpty
          ? product.id
          : '${product.store}_${DateTime.now().millisecondsSinceEpoch}_$index',
      title: product.title.isNotEmpty ? product.title : 'Produs fara titlu',
      description: product.description.isNotEmpty
          ? product.description
          : product.title,
      image: product.image.isNotEmpty
          ? product.image
          : 'https://via.placeholder.com/400x300/F5F5F5/999999?text=Produs',
    );
  }

  void _addToSearchHistory(String q) {
    if (q.trim().length < 2) return;
    setState(() {
      _searchHistory.removeWhere((item) => item['query'] == q);
      _searchHistory.insert(0, {
        'query': q,
        'timestamp': DateTime.now().toIso8601String(),
      });
      if (_searchHistory.length > 10) {
        _searchHistory = _searchHistory.sublist(0, 10);
      }
    });
    _storageService.saveSearchHistory(_searchHistory);
  }

  void _toggleWishlist(Product product) {
    setState(() {
      final index = _wishlist.indexWhere((item) => item.id == product.id);
      if (index > -1) {
        _wishlist.removeAt(index);
      } else {
        _wishlist.add(WishlistItem.fromProduct(product));
      }
    });
    _storageService.saveWishlist(_wishlist);
  }

  bool _isInWishlist(String productId) {
    return _wishlist.any((item) => item.id == productId);
  }

  Product? _findProductById(String productId) {
    for (final product in _scoredResults) {
      if (product.id == productId) {
        return product;
      }
    }
    for (final product in _products) {
      if (product.id == productId) {
        return product;
      }
    }
    return null;
  }

  List<Product> _getComparedProducts() {
    final compared = <Product>[];
    for (final productId in _compareProductIds) {
      final product = _findProductById(productId);
      if (product != null) {
        compared.add(product);
      }
    }
    return compared;
  }

  void _pruneCompareSelection(Iterable<Product> availableProducts) {
    if (!_quickCompareBetaEnabled || _compareProductIds.isEmpty) return;

    final validIds = availableProducts.map((p) => p.id).toSet();
    _compareProductIds.removeWhere((id) => !validIds.contains(id));
    _compareProductMetaById.removeWhere((key, _) => !validIds.contains(key));
    if (_compareProductIds.length < 2) {
      _showQuickCompare = false;
      _loadingQuickCompareMeta = false;
    }
  }

  void _toggleCompare(Product product) {
    if (!_quickCompareBetaEnabled) return;

    if (_compareProductIds.contains(product.id)) {
      setState(() {
        _compareProductIds.remove(product.id);
        _compareProductMetaById.remove(product.id);
        if (_compareProductIds.length < 2) {
          _showQuickCompare = false;
          _loadingQuickCompareMeta = false;
        }
      });
      return;
    }

    if (_compareProductIds.length >= 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Poti compara maxim 2 produse odata'),
        ),
      );
      return;
    }

    setState(() {
      _compareProductIds.add(product.id);
    });
  }

  void _clearCompareSelection() {
    if (!_quickCompareBetaEnabled) return;
    setState(() {
      _compareProductIds.clear();
      _showQuickCompare = false;
      _loadingQuickCompareMeta = false;
      _compareProductMetaById.clear();
    });
  }

  Future<void> _openQuickCompare() async {
    final compared = _getComparedProducts();
    if (compared.length != 2) return;

    setState(() {
      _showQuickCompare = true;
      _loadingQuickCompareMeta = true;
    });

    final result = <String, Map<String, dynamic>>{};
    for (final product in compared) {
      final url = product.productUrl.isNotEmpty
          ? product.productUrl
          : product.storeUrl;
      final meta = await _apiService.fetchProductMeta(
        store: product.store,
        productUrl: url,
      );
      if (meta != null) {
        result[product.id] = meta;
      }
    }

    if (!mounted) return;
    setState(() {
      _compareProductMetaById
        ..clear()
        ..addAll(result);
      _loadingQuickCompareMeta = false;
    });
  }

  void _applyFiltersAndDisplay(
      List<Product> prods, String q, Map<String, dynamic> filt) {
    final parsedFilters = <String, dynamic>{
      'minPrice': filt['minPrice'] != null
          ? double.tryParse(filt['minPrice'].toString())
          : null,
      'maxPrice': filt['maxPrice'] != null
          ? double.tryParse(filt['maxPrice'].toString())
          : null,
      'minRating': null,
      'inStock': filt['inStock'] ?? false,
      'sortBy': filt['sortBy'] ?? 'score',
    };

    final recommendations =
        _recommendationEngine.rankPreFilteredProducts(prods, q, parsedFilters);

    setState(() {
      _scoredResults = recommendations;
      _pruneCompareSelection(recommendations);
      _loading = false;
      if (recommendations.isEmpty) {
        _emptyState = 'noResults';
      } else {
        _emptyState = null;
      }
    });
  }

  String _selectSearchTerm(String query, Map<String, dynamic> interpretation) {
    final terms = (interpretation['searchTerms'] as List<dynamic>?)
            ?.map((term) => term.toString().trim())
            .where((term) => term.isNotEmpty)
            .toList() ??
        [];

    if (terms.isEmpty) {
      return query;
    }

    final usefulTerms = terms
        .map((term) => term.trim())
        .where((term) => term.length >= 2)
        .where((term) => !RegExp(r'^\d+([.,]\d+)?$').hasMatch(term))
        .where((term) => !RegExp(r'^\d+\s*(lei|le|mdl|ron|eur|euro)$',
                caseSensitive: false)
            .hasMatch(term))
        .where((term) => !{'bun', 'buna', 'buy', 'buying'}.contains(term.toLowerCase()))
        .toList();

    final selectedTerm =
        usefulTerms.take(3).toList().join(' ').trim().replaceAll(RegExp(r'\s+'), ' ');
    final selectedLower = selectedTerm.toLowerCase();
    final queryLower = query.toLowerCase();

    if (selectedTerm.isEmpty || selectedLower == queryLower) {
      return query;
    }

    if (queryLower.contains(selectedLower) && selectedTerm.length >= 3) {
      return selectedTerm;
    }

    final queryTokens = query
        .toLowerCase()
        .split(RegExp(r'\s+'))
        .where((token) => token.length >= 3)
        .toList();
    final preservedSignals = queryTokens
        .where((token) => selectedLower.contains(token))
        .length;

    return preservedSignals >= 1 ? selectedTerm : query;
  }

  Map<String, dynamic> _mergeAiFilters(
      Map<String, dynamic> baseFilters, Map<String, dynamic> interpretation) {
    final merged = Map<String, dynamic>.from(baseFilters);
    final aiFilters = interpretation['filters'];

    if (aiFilters is! Map<String, dynamic>) {
      return merged;
    }

    final maxPrice = double.tryParse(aiFilters['maxPrice']?.toString() ?? '');
    if (maxPrice != null && maxPrice > 0) {
      merged['maxPrice'] = maxPrice;
    }

    final minPrice = double.tryParse(aiFilters['minPrice']?.toString() ?? '');
    if (minPrice != null && minPrice >= 0) {
      merged['minPrice'] = minPrice;
    }

    if (aiFilters['inStock'] is bool) {
      merged['inStock'] = aiFilters['inStock'];
    }

    const allowedSorts = {'score', 'price-asc', 'price-desc'};
    final sortBy = aiFilters['sortBy']?.toString();
    if (sortBy != null && allowedSorts.contains(sortBy)) {
      merged['sortBy'] = sortBy;
    }

    return merged;
  }

  String _recommendationQuery(String originalQuery, String selectedSearchTerm) {
    final selected = selectedSearchTerm.trim();
    if (selected.length >= 3) {
      return selected;
    }
    return originalQuery;
  }

  Future<void> _performSearch(String? overrideQuery) async {
    final q = (overrideQuery ?? _query).trim();
    if (q.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Te rog introdu un termen de cautare'),
          ),
        );
      }
      return;
    }

    _addToSearchHistory(q);
    setState(() {
      _query = q;
      _loading = true;
      _emptyState = null;
      _scoredResults = [];
      _showQuickCompare = false;
      _compareProductIds.clear();
      _compareProductMetaById.clear();
      _loadingQuickCompareMeta = false;
    });

    try {
      final smartResult = await _apiService.smartSearch(q);
      final interpretation =
          smartResult['interpretation'] as Map<String, dynamic>? ??
              <String, dynamic>{};
      final rawProducts =
          smartResult['products'] as List<Product>? ?? <Product>[];
      final effectiveFilters = _mergeAiFilters(_filters, interpretation);

      setState(() {
        _filters = effectiveFilters;
      });

      final selectedSearchTerm = _selectSearchTerm(q, interpretation);
      final recommendationQuery = _recommendationQuery(q, selectedSearchTerm);

      final normalizedProducts = rawProducts
          .asMap()
          .entries
          .map((e) => _normalizeProduct(e.value, e.key))
          .toList();

      if (normalizedProducts.isEmpty) {
        setState(() {
          _loading = false;
          _emptyState = 'noResults';
        });
        return;
      }

      setState(() {
        _products = normalizedProducts;
        _pruneCompareSelection(normalizedProducts);
      });

      await Future.delayed(const Duration(milliseconds: 800));

      _applyFiltersAndDisplay(
          normalizedProducts, recommendationQuery, effectiveFilters);
    } catch (e) {
      setState(() {
        _loading = false;
        _emptyState = 'error';
      });
    }
  }

  Future<void> _handleLogout() async {
    await FirebaseAuth.instance.signOut();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  void _handleRemoveFromWishlist(WishlistItem item) {
    setState(() {
      _wishlist.removeWhere((w) => w.id == item.id);
    });
    _storageService.saveWishlist(_wishlist);
  }

  void _handleClearWishlist() {
    setState(() {
      _wishlist.clear();
      _showWishlist = false;
    });
    _storageService.saveWishlist(_wishlist);
  }

  void _handleWishlistItemTap(WishlistItem item) {
    Product? matched;
    for (final product in [..._scoredResults, ..._products]) {
      final sameId = product.id == item.id;
      final sameUrl =
          product.productUrl.isNotEmpty && product.productUrl == item.productUrl;
      final sameTitleStore = product.title == item.title && product.store == item.store;
      if (sameId || sameUrl || sameTitleStore) {
        matched = product;
        break;
      }
    }

    matched ??= Product(
      id: item.id,
      title: item.title,
      description: item.title,
      store: item.store,
      productUrl: item.productUrl,
      image: item.image,
      price: item.price,
      inStock: false,
    );

    setState(() {
      _showWishlist = false;
      _selectedProduct = matched;
    });
  }

  @override
  Widget build(BuildContext context) {
    final resultsCountText = _scoredResults.isNotEmpty
        ? '${_scoredResults.length} produse gasite in ${_scoredResults.map((p) => p.store).toSet().length} magazine'
        : '';
    final comparedProducts = _getComparedProducts();
    final showCompareBar = _quickCompareBetaEnabled &&
        !_loading &&
        comparedProducts.isNotEmpty &&
        _selectedProduct == null &&
        !_showWishlist &&
        !_showQuickCompare;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              // Sticky header with blur
              SliverPersistentHeader(
                pinned: true,
                delegate: _StickyHeaderDelegate(
                  child: ClipRect(
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Color(0xCCFFFFFF),
                          border: Border(
                            bottom:
                                BorderSide(color: AppColors.borderColor, width: 1),
                          ),
                        ),
                        child: SafeArea(
                          bottom: false,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 12),
                            child: Row(
                              children: [
                                const Text(
                                  'PriceRadar',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 20,
                                    color: AppColors.textPrimary,
                                    letterSpacing: -0.5,
                                  ),
                                ),
                                const Spacer(),
                                Text(
                                  widget.user.displayName ?? 'User',
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 13,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                GestureDetector(
                                  onTap: () =>
                                      setState(() => _showWishlist = true),
                                  child: Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                          color: AppColors.borderColor),
                                    ),
                                    child: Stack(
                                      clipBehavior: Clip.none,
                                      children: [
                                        const Center(
                                          child: Icon(
                                            Icons.favorite_border,
                                            color: AppColors.textSecondary,
                                            size: 18,
                                          ),
                                        ),
                                        if (_wishlist.isNotEmpty)
                                          Positioned(
                                            right: -2,
                                            top: -2,
                                            child: Container(
                                              width: 16,
                                              height: 16,
                                              decoration: const BoxDecoration(
                                                color: AppColors.primary,
                                                shape: BoxShape.circle,
                                              ),
                                              child: Center(
                                                child: Text(
                                                  '${_wishlist.length}',
                                                  style: const TextStyle(
                                                    color: Colors.white,
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                GestureDetector(
                                  onTap: _handleLogout,
                                  child: Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                          color: AppColors.borderColor),
                                    ),
                                    child: const Center(
                                      child: Icon(
                                        Icons.logout,
                                        color: AppColors.textSecondary,
                                        size: 18,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  height: MediaQuery.of(context).padding.top + 60,
                ),
              ),

              // Search bar
              SliverToBoxAdapter(
                child: SearchBarWidget(
                  query: _query,
                  onQueryChanged: (q) => setState(() => _query = q),
                  onSearch: _performSearch,
                  searchHistory: _searchHistory,
                  onClearHistory: () {
                    setState(() => _searchHistory.clear());
                    _storageService.saveSearchHistory(_searchHistory);
                  },
                  onHistoryItemClick: (q) {
                    setState(() => _query = q);
                    _performSearch(q);
                  },
                ),
              ),

              // Filters toolbar
              if (_scoredResults.isNotEmpty || _loading)
                SliverToBoxAdapter(
                  child: FiltersToolbar(
                    filters: _filters,
                    onChanged: (newFilters) {
                      setState(() => _filters = newFilters);
                      if (_products.isNotEmpty && _query.isNotEmpty) {
                        _applyFiltersAndDisplay(_products, _query, newFilters);
                      }
                    },
                    resultsCount: resultsCountText,
                  ),
                ),

              // Loading state
              if (_loading)
                const SliverFillRemaining(
                  child: _LoadingState(),
                ),

              // Product grid
              if (!_loading && _scoredResults.isNotEmpty) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Recomandari',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.3,
                          ),
                        ),
                        Text(
                          resultsCountText,
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.52,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final product = _scoredResults[index];
                        final reasons =
                            _recommendationEngine.generateExplanation(product);
                        return ProductCard(
                          product: product,
                          rank: index + 1,
                          isWishlisted: _isInWishlist(product.id),
                          isCompared: _compareProductIds.contains(product.id),
                          compareEnabled: _quickCompareBetaEnabled,
                          reasons: reasons,
                          formatPrice: formatPrice,
                          onDetailsClick: () {
                            setState(() => _selectedProduct = product);
                          },
                          onWishlistToggle: () => _toggleWishlist(product),
                          onCompareToggle: () => _toggleCompare(product),
                        );
                      },
                      childCount: _scoredResults.length,
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],

              // Empty states
              if (!_loading && _emptyState == 'welcome')
                const SliverFillRemaining(child: _WelcomeState()),

              if (!_loading && _emptyState == 'noResults')
                SliverFillRemaining(
                  child: _NoResultsState(
                    query: _query,
                    onReset: () {
                      setState(() {
                        _query = '';
                        _emptyState = 'welcome';
                        _scoredResults = [];
                      });
                    },
                  ),
                ),

              if (!_loading && _emptyState == 'error')
                const SliverFillRemaining(child: _ErrorState()),
            ],
          ),

          if (showCompareBar)
            Positioned(
              left: 16,
              right: 16,
              bottom: 16 + MediaQuery.of(context).padding.bottom,
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderColor),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Comparare rapida (beta): ${comparedProducts.length}/2',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: _clearCompareSelection,
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text(
                          'Goleste',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: comparedProducts.length == 2
                          ? _openQuickCompare
                          : null,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: comparedProducts.length == 2
                              ? AppColors.primary
                              : AppColors.surface,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'Compara',
                          style: TextStyle(
                            color: comparedProducts.length == 2
                                ? Colors.white
                                : AppColors.textMuted,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          if (_showQuickCompare && comparedProducts.length == 2)
            _QuickCompareModal(
              products: comparedProducts,
              productMetaById: _compareProductMetaById,
              loadingMeta: _loadingQuickCompareMeta,
              formatPrice: formatPrice,
              onClose: () => setState(() => _showQuickCompare = false),
              onOpenProduct: (product) {
                setState(() {
                  _showQuickCompare = false;
                  _selectedProduct = product;
                });
              },
            ),

          // Product modal
          if (_selectedProduct != null)
            ProductModal(
              product: _selectedProduct!,
              allProducts: _products,
              recommendationEngine: _recommendationEngine,
              formatPrice: formatPrice,
              wishlist: _wishlist,
              onWishlistToggle: () => _toggleWishlist(_selectedProduct!),
              onSimilarClick: (product) {
                setState(() => _selectedProduct = product);
              },
              onClose: () => setState(() => _selectedProduct = null),
            ),

          // Wishlist modal
          if (_showWishlist)
            WishlistModal(
              wishlist: _wishlist,
              formatPrice: formatPrice,
              onClose: () => setState(() => _showWishlist = false),
              onRemove: _handleRemoveFromWishlist,
              onClearAll: _handleClearWishlist,
              onItemTap: _handleWishlistItemTap,
            ),
        ],
      ),
    );
  }
}

class _QuickCompareProductMeta {
  final String deliveryLabel;
  final int? deliveryDays;
  final String warrantyLabel;
  final int? warrantyMonths;
  final List<String> paymentMethods;

  const _QuickCompareProductMeta({
    required this.deliveryLabel,
    required this.deliveryDays,
    required this.warrantyLabel,
    required this.warrantyMonths,
    required this.paymentMethods,
  });
}

class _QuickCompareModal extends StatelessWidget {
  final List<Product> products;
  final Map<String, Map<String, dynamic>> productMetaById;
  final bool loadingMeta;
  final String Function(double) formatPrice;
  final void Function(Product) onOpenProduct;
  final VoidCallback onClose;

  const _QuickCompareModal({
    required this.products,
    required this.productMetaById,
    required this.loadingMeta,
    required this.formatPrice,
    required this.onOpenProduct,
    required this.onClose,
  });

  String _allText(Product product) {
    return [
      product.title,
      product.description,
      ...product.specs,
    ].join(' ').toLowerCase();
  }

  _QuickCompareProductMeta _extractMeta(
      Product product, Map<String, dynamic>? productMeta) {
    final text = _allText(product);

    int? deliveryDays;
    String deliveryLabel = 'Nedisponibil';
    final dayRangeRegex = RegExp(
        r'(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(zile|zi|days|day|дн)',
        caseSensitive: false);
    final daySingleRegex =
        RegExp(r'(\d{1,2})\s*(zile|zi|days|day|дн)', caseSensitive: false);
    final nextDayRegex = RegExp(r'(livrare rapida|24h|same day|next day)',
        caseSensitive: false);

    final rangeMatch = dayRangeRegex.firstMatch(text);
    if (rangeMatch != null) {
      final minDays = int.tryParse(rangeMatch.group(1) ?? '');
      final maxDays = int.tryParse(rangeMatch.group(2) ?? '');
      if (minDays != null && maxDays != null) {
        deliveryDays = minDays;
        deliveryLabel = '$minDays-$maxDays zile';
      }
    } else {
      final singleMatch = daySingleRegex.firstMatch(text);
      if (singleMatch != null) {
        final days = int.tryParse(singleMatch.group(1) ?? '');
        if (days != null) {
          deliveryDays = days;
          deliveryLabel = '$days zile';
        }
      } else if (nextDayRegex.hasMatch(text)) {
        deliveryDays = 1;
        deliveryLabel = '1 zi';
      }
    }

    int? warrantyMonths;
    String warrantyLabel = 'Nedisponibila';
    final monthRegex = RegExp(
        r'(\d{1,3})\s*(luni|luna|month|months|месяц|месяца|месяцев)',
        caseSensitive: false);
    final yearRegex = RegExp(r'(\d{1,2})\s*(ani|an|year|years|год|года|лет)',
        caseSensitive: false);
    final warrantyRegex = RegExp(r'(garantie|warranty|гарант)',
        caseSensitive: false);

    if (warrantyRegex.hasMatch(text)) {
      final monthMatch = monthRegex.firstMatch(text);
      if (monthMatch != null) {
        final months = int.tryParse(monthMatch.group(1) ?? '');
        if (months != null) {
          warrantyMonths = months;
          warrantyLabel = '$months luni';
        }
      } else {
        final yearMatch = yearRegex.firstMatch(text);
        if (yearMatch != null) {
          final years = int.tryParse(yearMatch.group(1) ?? '');
          if (years != null) {
            warrantyMonths = years * 12;
            warrantyLabel = '$years ani';
          }
        } else {
          warrantyLabel = 'Da (durata n/a)';
        }
      }
    }

    final paymentMethods = <String>[];
    final paymentSignals = <String, List<String>>{
      'Card': ['card', 'visa', 'mastercard'],
      'Cash': ['cash', 'numerar', 'ramburs'],
      'Rate': ['rate', 'credit', 'leasing', 'installment'],
      'Transfer': ['transfer', 'iban', 'ordin de plata'],
    };

    for (final entry in paymentSignals.entries) {
      if (entry.value.any((signal) => text.contains(signal))) {
        paymentMethods.add(entry.key);
      }
    }

    final backendDeliverySummary =
        productMeta?['deliverySummary']?.toString().trim() ?? '';
    if (backendDeliverySummary.isNotEmpty) {
      deliveryLabel = backendDeliverySummary;
    }
    final backendDeliveryMinLei =
        int.tryParse('${productMeta?['deliveryMinLei'] ?? ''}');
    if (backendDeliveryMinLei != null && backendDeliveryMinLei > 0) {
      deliveryDays ??= 1;
    }

    final backendWarranty = productMeta?['warrantySummary']?.toString().trim() ?? '';
    if (backendWarranty.isNotEmpty) {
      warrantyLabel = backendWarranty;
      final monthMatch = monthRegex.firstMatch(backendWarranty);
      if (monthMatch != null) {
        warrantyMonths = int.tryParse(monthMatch.group(1) ?? '') ?? warrantyMonths;
      }
    }

    final backendPayments = (productMeta?['paymentMethods'] is List)
        ? (productMeta?['paymentMethods'] as List)
            .map((item) => item.toString().trim())
            .where((item) => item.isNotEmpty)
            .toList()
        : const <String>[];
    if (backendPayments.isNotEmpty) {
      paymentMethods
        ..clear()
        ..addAll(backendPayments);
    }

    return _QuickCompareProductMeta(
      deliveryLabel: deliveryLabel,
      deliveryDays: deliveryDays,
      warrantyLabel: warrantyLabel,
      warrantyMonths: warrantyMonths,
      paymentMethods: paymentMethods,
    );
  }

  Color _bestCellColor(bool best) {
    if (!best) return AppColors.surface;
    return const Color(0xFFE8F8EF);
  }

  Widget _buildTableRow({
    required String label,
    required String leftValue,
    required String rightValue,
    bool leftBest = false,
    bool rightBest = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 92,
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              decoration: BoxDecoration(
                color: _bestCellColor(leftBest),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.borderColor),
              ),
              child: Text(
                leftValue,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 12,
                  fontWeight: leftBest ? FontWeight.w700 : FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              decoration: BoxDecoration(
                color: _bestCellColor(rightBest),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.borderColor),
              ),
              child: Text(
                rightValue,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 12,
                  fontWeight: rightBest ? FontWeight.w700 : FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCard(Product product) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              product.store.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              product.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final left = products[0];
    final right = products[1];
    final leftMeta = _extractMeta(left, productMetaById[left.id]);
    final rightMeta = _extractMeta(right, productMetaById[right.id]);

    final leftIsCheaper = left.price < right.price;
    final rightIsCheaper = right.price < left.price;
    final leftInStockBest = left.inStock && !right.inStock;
    final rightInStockBest = right.inStock && !left.inStock;

    final leftDeliveryBest = leftMeta.deliveryDays != null &&
        (rightMeta.deliveryDays == null ||
            leftMeta.deliveryDays! < rightMeta.deliveryDays!);
    final rightDeliveryBest = rightMeta.deliveryDays != null &&
        (leftMeta.deliveryDays == null ||
            rightMeta.deliveryDays! < leftMeta.deliveryDays!);

    final leftWarrantyBest = leftMeta.warrantyMonths != null &&
        (rightMeta.warrantyMonths == null ||
            leftMeta.warrantyMonths! > rightMeta.warrantyMonths!);
    final rightWarrantyBest = rightMeta.warrantyMonths != null &&
        (leftMeta.warrantyMonths == null ||
            rightMeta.warrantyMonths! > leftMeta.warrantyMonths!);

    final leftPayments = leftMeta.paymentMethods.isEmpty
        ? 'Nedisponibil'
        : leftMeta.paymentMethods.join(', ');
    final rightPayments = rightMeta.paymentMethods.isEmpty
        ? 'Nedisponibil'
        : rightMeta.paymentMethods.join(', ');

    final leftPaymentBest = leftMeta.paymentMethods.length > rightMeta.paymentMethods.length;
    final rightPaymentBest = rightMeta.paymentMethods.length > leftMeta.paymentMethods.length;

    return Material(
      color: Colors.black.withValues(alpha: 0.45),
      child: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.9,
            ),
            child: SingleChildScrollView(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Comparare rapida (beta)',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        GestureDetector(
                          onTap: onClose,
                          child: const Icon(
                            Icons.close,
                            color: AppColors.textSecondary,
                            size: 18,
                          ),
                        ),
                      ],
                    ),
                    if (loadingMeta)
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 1.8,
                                color: AppColors.textMuted,
                              ),
                            ),
                            SizedBox(width: 8),
                            Text(
                              'Se incarca detalii magazin...',
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 10),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildHeaderCard(left),
                        const SizedBox(width: 8),
                        _buildHeaderCard(right),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _buildTableRow(
                      label: 'Pret',
                      leftValue: formatPrice(left.price),
                      rightValue: formatPrice(right.price),
                      leftBest: leftIsCheaper,
                      rightBest: rightIsCheaper,
                    ),
                    _buildTableRow(
                      label: 'Magazin',
                      leftValue: left.store,
                      rightValue: right.store,
                    ),
                    _buildTableRow(
                      label: 'Disponibil',
                      leftValue: left.inStock ? 'In stoc' : 'Indisponibil',
                      rightValue: right.inStock ? 'In stoc' : 'Indisponibil',
                      leftBest: leftInStockBest,
                      rightBest: rightInStockBest,
                    ),
                    _buildTableRow(
                      label: 'Livrare',
                      leftValue: leftMeta.deliveryLabel,
                      rightValue: rightMeta.deliveryLabel,
                      leftBest: leftDeliveryBest,
                      rightBest: rightDeliveryBest,
                    ),
                    _buildTableRow(
                      label: 'Garantie',
                      leftValue: leftMeta.warrantyLabel,
                      rightValue: rightMeta.warrantyLabel,
                      leftBest: leftWarrantyBest,
                      rightBest: rightWarrantyBest,
                    ),
                    _buildTableRow(
                      label: 'Plata',
                      leftValue: leftPayments,
                      rightValue: rightPayments,
                      leftBest: leftPaymentBest,
                      rightBest: rightPaymentBest,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () => onOpenProduct(left),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'Detalii produs',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => onOpenProduct(right),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'Detalii produs',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
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
          ),
        ),
      ),
    );
  }
}

class _StickyHeaderDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;
  final double height;

  _StickyHeaderDelegate({required this.child, required this.height});

  @override
  double get minExtent => height;
  @override
  double get maxExtent => height;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return SizedBox(height: height, child: child);
  }

  @override
  bool shouldRebuild(covariant _StickyHeaderDelegate oldDelegate) {
    return height != oldDelegate.height || child != oldDelegate.child;
  }
}

// --- Empty State Widgets ---

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(
              color: AppColors.primary,
              strokeWidth: 2,
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Se cauta...',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}

class _WelcomeState extends StatelessWidget {
  const _WelcomeState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search, size: 48, color: AppColors.textMuted.withValues(alpha: 0.4)),
          const SizedBox(height: 16),
          const Text(
            'Cauta produsul potrivit pentru tine',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 15),
          ),
          const SizedBox(height: 8),
          const Text(
            'Comparam automat preturile din magazinele partenere',
            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _NoResultsState extends StatelessWidget {
  final String query;
  final VoidCallback onReset;
  const _NoResultsState({required this.query, required this.onReset});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.info_outline,
              size: 48, color: AppColors.textMuted.withValues(alpha: 0.4)),
          const SizedBox(height: 16),
          Text(
            'Nu am gasit rezultate pentru "$query"',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Incearca sa modifici termenii de cautare sau filtrele',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
          ),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: onReset,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'Intoarce-te la inceput',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline,
              size: 48, color: AppColors.textMuted.withValues(alpha: 0.4)),
          const SizedBox(height: 16),
          const Text(
            'A aparut o eroare',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Te rog incearca din nou intr-un moment',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
          ),
        ],
      ),
    );
  }
}
