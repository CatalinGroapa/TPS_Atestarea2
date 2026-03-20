import React, { useState, useEffect, useRef, useCallback } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../config/firebase'
import { NLPEngine } from '../engines/nlp-engine'
import { RecommendationEngine } from '../engines/recommendation-engine'
import { ProductScraper } from '../services/scraper'
import Header from '../components/Header'
import SearchBar from '../components/SearchBar'
import FiltersToolbar from '../components/FiltersToolbar'
import ProductGrid from '../components/ProductGrid'
import ProductModal from '../components/ProductModal'
import WishlistModal from '../components/WishlistModal'
import '../../styles/styles.css'

const CURRENCY = 'MDL'

export default function HomePage({ user }) {
  const navigate = useNavigate()

  // Engine refs (instantiated once)
  const nlpEngine = useRef(null)
  const recommendationEngine = useRef(null)
  const scraper = useRef(null)

  if (!nlpEngine.current) {
    nlpEngine.current = new NLPEngine()
    recommendationEngine.current = new RecommendationEngine(nlpEngine.current)
    scraper.current = new ProductScraper()
  }

  // State
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState([]) // raw normalized products
  const [scoredResults, setScoredResults] = useState([])
  const [filters, setFilters] = useState({
    maxPrice: '',
    minRating: '0',
    inStock: false,
    sortBy: 'score',
  })
  const [loading, setLoading] = useState(false)
  const [searchHistory, setSearchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('searchHistory')) || [] } catch { return [] }
  })
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wishlist')) || [] } catch { return [] }
  })
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [showWishlist, setShowWishlist] = useState(false)
  // 'welcome' | 'noResults' | 'error' | null
  const [emptyState, setEmptyState] = useState('welcome')

  const resultsSectionRef = useRef(null)

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('wishlist', JSON.stringify(wishlist))
  }, [wishlist])
  useEffect(() => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory))
  }, [searchHistory])

  // --- Helpers ---
  function formatPrice(price) {
    const safePrice = Number(price)
    return `${(Number.isFinite(safePrice) ? safePrice : 0).toLocaleString('ro-MD')} ${CURRENCY}`
  }

  function generateStars(rating) {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)
    return '⭐'.repeat(fullStars) + (hasHalfStar ? '✨' : '') + '☆'.repeat(emptyStars)
  }

  function normalizeProduct(product, index) {
    const safePrice = Number(product?.price)
    const safeRating = Number(product?.rating)
    const safeReviewCount = Number(product?.reviewCount ?? product?.reviews ?? 0)
    const sourceStore = String(product?.store || 'Magazin')
    const cleanStore = sourceStore.replace(/\.md$/i, '')

    return {
      ...product,
      id: product?.id || `${cleanStore}_${Date.now()}_${index}`,
      title: product?.title || 'Produs fără titlu',
      description: product?.description || product?.title || '',
      price: Number.isFinite(safePrice) ? safePrice : 0,
      rating: Number.isFinite(safeRating) ? safeRating : 0,
      reviewCount: Number.isFinite(safeReviewCount) ? safeReviewCount : 0,
      store: cleanStore,
      storeUrl: product?.storeUrl || '',
      productUrl: product?.productUrl || product?.link || product?.storeUrl || '',
      image: product?.image || 'https://via.placeholder.com/400x300/1e293b/6366f1?text=Produs',
      inStock: Boolean(product?.inStock),
      reviews: Array.isArray(product?.reviews) ? product.reviews : [],
      specs: Array.isArray(product?.specs) ? product.specs : [],
    }
  }

  function addToSearchHistory(q) {
    if (!q || q.trim().length < 2) return
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item.query !== q)
      return [{ query: q, timestamp: new Date().toISOString() }, ...filtered].slice(0, 10)
    })
  }

  function toggleWishlist(product) {
    setWishlist((prev) => {
      const index = prev.findIndex((item) => item.id === product.id)
      if (index > -1) {
        return prev.filter((_, i) => i !== index)
      }
      return [
        ...prev,
        {
          id: product.id,
          title: product.title,
          price: product.price,
          image: product.image,
          store: product.store,
          link: product.productUrl || product.storeUrl || '',
          productUrl: product.productUrl || product.storeUrl || '',
          storeUrl: product.storeUrl || '',
          addedAt: new Date().toISOString(),
        },
      ]
    })
  }

  function isInWishlist(productId) {
    return wishlist.some((item) => item.id === productId)
  }

  // --- Apply filters ---
  const applyFiltersAndDisplay = useCallback(
    (prods, q, filt) => {
      const parsedFilters = {
        maxPrice: filt.maxPrice ? parseFloat(filt.maxPrice) : null,
        minRating: parseFloat(filt.minRating),
        inStock: filt.inStock,
        sortBy: filt.sortBy,
      }
      const recommendations = recommendationEngine.current.recommendProducts(prods, q, parsedFilters)
      setScoredResults(recommendations)
      setLoading(false)
      if (recommendations.length === 0) {
        setEmptyState('noResults')
      } else {
        setEmptyState(null)
        setTimeout(() => {
          resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }
    },
    []
  )

  // Re-apply filters when filters change and we have products
  useEffect(() => {
    if (products.length > 0 && query) {
      applyFiltersAndDisplay(products, query, filters)
    }
  }, [filters, products, query, applyFiltersAndDisplay])

  // --- Search ---
  async function performSearch(overrideQuery) {
    const q = (overrideQuery !== undefined ? overrideQuery : query).trim()
    if (!q) {
      alert('Te rog introdu un termen de căutare')
      return
    }

    addToSearchHistory(q)
    setLoading(true)
    setEmptyState(null)
    setScoredResults([])

    try {
      const rawProducts = await scraper.current.scrapeAllStores(q)
      const normalizedProducts = rawProducts.map((product, index) => normalizeProduct(product, index))

      if (normalizedProducts.length === 0) {
        setLoading(false)
        setEmptyState('noResults')
        return
      }

      setProducts(normalizedProducts)

      // Small delay for AI processing effect
      await new Promise((resolve) => setTimeout(resolve, 800))

      applyFiltersAndDisplay(normalizedProducts, q, filters)
    } catch (error) {
      console.error('Error during search:', error)
      setLoading(false)
      setEmptyState('error')
    }
  }

  // --- Auth ---
  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  // --- Selected product ---
  const selectedProduct = selectedProductId
    ? [...scoredResults, ...products].find((p) => p.id === selectedProductId) || null
    : null

  // --- Wishlist handlers ---
  function handleRemoveFromWishlist(item) {
    toggleWishlist(item)
  }

  function handleClearWishlist() {
    if (confirm('Sigur vrei să ștergi toate produsele din lista de favorite?')) {
      setWishlist([])
      setShowWishlist(false)
    }
  }

  // Results count string
  const resultsCountText = scoredResults.length > 0
    ? `${scoredResults.length} produse găsite în ${new Set(scoredResults.map((p) => p.store)).size} magazine`
    : ''

  return (
    <>
      <Header
        user={user}
        wishlistCount={wishlist.length}
        onWishlistClick={() => setShowWishlist(true)}
        onLogout={handleLogout}
      />

      <SearchBar
        query={query}
        onQueryChange={setQuery}
        onSearch={performSearch}
        searchHistory={searchHistory}
        onClearHistory={() => setSearchHistory([])}
        onHistoryItemClick={(q) => { setQuery(q); performSearch(q) }}
      />

      <FiltersToolbar
        filters={filters}
        onChange={setFilters}
        resultsCount={resultsCountText}
        show={scoredResults.length > 0 || loading}
      />

      <main className="main-content">
        <div className="content-wrap">
          {loading && (
            <div id="loadingState" className="loading-state">
              <div className="spinner"></div>
              <p className="loading-state__text">Analizez produsele cu AI…</p>
              <p className="loading-state__sub">
                Caut în Darwin 🦎, Cactus 🌵, Bomba 💣 și PandaShop 🐼
              </p>
            </div>
          )}

          {!loading && scoredResults.length > 0 && (
            <section id="resultsSection" className="results-section" ref={resultsSectionRef}>
              <div className="results-header">
                <h2 className="results-header__title">Recomandări</h2>
                <span id="resultsCount" className="results-count">{resultsCountText}</span>
              </div>
              <ProductGrid
                products={scoredResults}
                wishlist={wishlist}
                onProductClick={(id) => setSelectedProductId(id)}
                onWishlistToggle={toggleWishlist}
                formatPrice={formatPrice}
                generateStars={generateStars}
                recommendationEngine={recommendationEngine.current}
              />
            </section>
          )}

          {!loading && emptyState === 'welcome' && (
            <div id="emptyState" className="empty-state">
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p>Căutăm produsele în <strong>Darwin, Cactus, Bomba și PandaShop</strong></p>
              <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                Prețuri în <strong>Lei MDL</strong> • Analiză AI • Comparare automată
              </p>
            </div>
          )}

          {!loading && emptyState === 'noResults' && (
            <div id="emptyState" className="empty-state">
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path d="M12 8v4m0 4h.01" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <h3>Nu am găsit rezultate pentru &ldquo;{query}&rdquo;</h3>
              <p>Încearcă să modifici termenii de căutare sau filtrele</p>
              <button
                onClick={() => { setQuery(''); setEmptyState('welcome'); setScoredResults([]) }}
                style={{
                  marginTop: '1rem',
                  background: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                Întoarce-te la început
              </button>
            </div>
          )}

          {!loading && emptyState === 'error' && (
            <div id="emptyState" className="empty-state">
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <h3>Oops! A apărut o eroare</h3>
              <p>Te rog încearcă din nou într-un moment</p>
            </div>
          )}
        </div>
      </main>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          allProducts={products}
          recommendationEngine={recommendationEngine.current}
          onClose={() => setSelectedProductId(null)}
          onSimilarClick={(id) => setSelectedProductId(id)}
          formatPrice={formatPrice}
          generateStars={generateStars}
          wishlist={wishlist}
          onWishlistToggle={toggleWishlist}
        />
      )}

      {showWishlist && (
        <WishlistModal
          wishlist={wishlist}
          onClose={() => setShowWishlist(false)}
          onRemove={handleRemoveFromWishlist}
          onClearAll={handleClearWishlist}
          formatPrice={formatPrice}
        />
      )}
    </>
  )
}
