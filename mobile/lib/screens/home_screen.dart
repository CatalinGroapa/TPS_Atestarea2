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
  // Engines
  late final NLPEngine _nlpEngine;
  late final RecommendationEngine _recommendationEngine;
  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService();

  // State
  String _query = '';
  List<Product> _products = [];
  List<Product> _scoredResults = [];
  Map<String, dynamic> _filters = {
    'maxPrice': null,
    'minRating': 0.0,
    'inStock': false,
    'sortBy': 'score',
  };
  bool _loading = false;
  List<Map<String, dynamic>> _searchHistory = [];
  List<WishlistItem> _wishlist = [];
  Product? _selectedProduct;
  bool _showWishlist = false;
  String? _emptyState = 'welcome';
  Map<String, dynamic>? _aiInsight;

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

  // --- Helpers ---
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
          : 'https://via.placeholder.com/400x300/1e293b/6366f1?text=Produs',
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

  // --- Apply filters ---
  void _applyFiltersAndDisplay(
      List<Product> prods, String q, Map<String, dynamic> filt) {
    final parsedFilters = <String, dynamic>{
      'maxPrice': filt['maxPrice'] != null
          ? double.tryParse(filt['maxPrice'].toString())
          : null,
      'minRating': double.tryParse(filt['minRating'].toString()) ?? 0.0,
      'inStock': filt['inStock'] ?? false,
      'sortBy': filt['sortBy'] ?? 'score',
    };

    final recommendations =
        _recommendationEngine.recommendProducts(prods, q, parsedFilters);

    setState(() {
      _scoredResults = recommendations;
      _loading = false;
      if (recommendations.isEmpty) {
        _emptyState = 'noResults';
      } else {
        _emptyState = null;
      }
    });
  }

  // --- Search ---
  Future<void> _performSearch(String? overrideQuery) async {
    final q = (overrideQuery ?? _query).trim();
    if (q.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Te rog introdu un termen de cautare'),
            backgroundColor: AppColors.warning,
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
      _aiInsight = null;
    });

    try {
      // Interpret query with AI
      final interpretation = await _apiService.interpretQuery(q);
      final searchTerms = (interpretation['searchTerms'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [q];

      if (interpretation['fallback'] != true) {
        setState(() {
          _aiInsight = interpretation;
        });
      }

      // Search products
      final rawProducts = await _apiService.searchProducts(
          searchTerms.isNotEmpty ? searchTerms[0] : q);

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
      });

      // Small delay for AI processing effect
      await Future.delayed(const Duration(milliseconds: 800));

      _applyFiltersAndDisplay(normalizedProducts, q, _filters);
    } catch (e) {
      setState(() {
        _loading = false;
        _emptyState = 'error';
      });
    }
  }

  // --- Auth ---
  Future<void> _handleLogout() async {
    await FirebaseAuth.instance.signOut();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  // --- Wishlist handlers ---
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

  @override
  Widget build(BuildContext context) {
    final resultsCountText = _scoredResults.isNotEmpty
        ? '${_scoredResults.length} produse gasite in ${_scoredResults.map((p) => p.store).toSet().length} magazine'
        : '';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: Row(
          children: [
            const Text(
              'PulsePrice',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 20,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 8),
            // Store badges
            ..._buildStoreBadges(),
          ],
        ),
        actions: [
          // User name
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Center(
              child: Text(
                widget.user.displayName ?? 'User',
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                ),
              ),
            ),
          ),
          // Wishlist button with badge
          Stack(
            children: [
              IconButton(
                onPressed: () => setState(() => _showWishlist = true),
                icon: const Icon(Icons.favorite, color: AppColors.danger),
                tooltip: 'Lista de favorite',
              ),
              if (_wishlist.isNotEmpty)
                Positioned(
                  right: 4,
                  top: 4,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppColors.danger,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      '${_wishlist.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          // Logout
          IconButton(
            onPressed: _handleLogout,
            icon: const Icon(Icons.logout, color: AppColors.textSecondary),
            tooltip: 'Deconectare',
          ),
        ],
      ),
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
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

              // AI Insight chip
              if (_aiInsight != null && !_loading)
                SliverToBoxAdapter(
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Text('🤖',
                              style: TextStyle(fontSize: 18)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'AI: ${_aiInsight!['intent'] ?? _query}',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
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
                            fontWeight: FontWeight.bold,
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
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  sliver: SliverGrid(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.52,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
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
                          reasons: reasons,
                          formatPrice: formatPrice,
                          onDetailsClick: () {
                            setState(() => _selectedProduct = product);
                          },
                          onWishlistToggle: () => _toggleWishlist(product),
                        );
                      },
                      childCount: _scoredResults.length,
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 24)),
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
            ),
        ],
      ),
    );
  }

  List<Widget> _buildStoreBadges() {
    const stores = [
      {'name': 'Darwin', 'emoji': '\u{1F98E}'},
      {'name': 'Cactus', 'emoji': '\u{1F335}'},
      {'name': 'Bomba', 'emoji': '\u{1F4A3}'},
      {'name': 'Panda', 'emoji': '\u{1F43C}'},
    ];
    return stores
        .map((store) => Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Text(
                store['emoji']!,
                style: const TextStyle(fontSize: 14),
              ),
            ))
        .toList();
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
          const CircularProgressIndicator(color: AppColors.primary),
          const SizedBox(height: 24),
          const Text(
            'Analizez produsele cu AI...',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Caut in Darwin \u{1F98E}, Cactus \u{1F335}, Bomba \u{1F4A3} si PandaShop \u{1F43C}',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 14,
            ),
            textAlign: TextAlign.center,
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
          Icon(Icons.search, size: 64, color: AppColors.textMuted),
          const SizedBox(height: 16),
          const Text(
            'Cautam produsele in Darwin, Cactus, Bomba si PandaShop',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text(
            'Preturi in Lei MDL \u{2022} Analiza AI \u{2022} Comparare automata',
            style: TextStyle(color: AppColors.textMuted, fontSize: 14),
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
          Icon(Icons.info_outline, size: 64, color: AppColors.textMuted),
          const SizedBox(height: 16),
          Text(
            'Nu am gasit rezultate pentru "$query"',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Incearca sa modifici termenii de cautare sau filtrele',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: onReset,
            child: const Text('Intoarce-te la inceput'),
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
          Icon(Icons.error_outline, size: 64, color: AppColors.danger),
          const SizedBox(height: 16),
          const Text(
            'Oops! A aparut o eroare',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
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
