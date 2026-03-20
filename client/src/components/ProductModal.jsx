import React from 'react'

const storeEmoji = {
  Darwin: '🦎',
  Cactus: '🌵',
  Bomba: '💣',
  PandaShop: '🐼',
}

function translateScoreKey(key) {
  const translations = {
    price: 'Preț',
    rating: 'Rating',
    reviews: 'Recenzii',
    availability: 'Disponibil',
    relevance: 'Relevanță',
  }
  return translations[key] || key
}

export default function ProductModal({
  product,
  allProducts,
  recommendationEngine,
  onClose,
  onSimilarClick,
  formatPrice,
  generateStars,
  wishlist,
  onWishlistToggle,
}) {
  if (!product) return null

  const isWishlisted = wishlist.some((item) => item.id === product.id)

  const similar = recommendationEngine
    ? recommendationEngine.findSimilarProducts(product, allProducts, 3)
    : []

  const scoreBreakdown = product.scoreBreakdown || {
    price: 0,
    rating: 0,
    reviews: 0,
    availability: product.inStock ? 100 : 0,
    relevance: 0,
  }

  return (
    <div id="productModal" className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div id="modalBody">
          <div style={{ padding: '2rem' }}>
            <img
              src={product.image}
              alt={product.title}
              style={{ width: '100%', height: '300px', objectFit: 'cover', borderRadius: '1rem', marginBottom: '1.5rem' }}
              onError={(e) => { e.target.src = 'https://via.placeholder.com/800x300/1e293b/6366f1?text=Produs' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <span style={{ background: 'var(--background)', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '1rem', color: 'var(--text-secondary)', display: 'inline-block' }}>
                  {storeEmoji[product.store] || '🏪'} {product.store}
                </span>
                <h2 style={{ marginTop: '1rem', color: 'var(--text-primary)', fontSize: '1.5rem', lineHeight: 1.4 }}>
                  {product.title}
                </h2>
              </div>
              <div style={{ textAlign: 'right', background: 'var(--background)', padding: '1rem', borderRadius: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Scor AI</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--success-color)' }}>
                  {product.recommendationScore}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>din 100</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--warning-color)', fontSize: '1.3rem' }}>
                  {generateStars(product.rating)}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {Number(product.rating || 0).toFixed(1)}
                </span>
              </div>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--text-secondary)' }}>{product.reviewCount || 0} recenzii</span>
              <span style={{
                marginLeft: 'auto',
                background: product.inStock ? 'var(--success-color)' : 'var(--danger-color)',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}>
                {product.inStock ? '✓ În stoc' : '✗ Indisponibil'}
              </span>
            </div>

            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '2rem' }}>
              {product.description}
            </p>

            {product.specs && product.specs.length > 0 && (
              <div style={{ background: 'var(--background)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⚙️</span> Specificații Tehnice
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {product.specs.map((spec, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--primary-color)' }}>▪</span>
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: 'var(--background)', padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🤖</span> Analiza AI
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.5rem' }}>
                {Object.entries(scoreBreakdown)
                  .filter(([key]) => key !== 'sentiment')
                  .map(([key, value]) => (
                    <div key={key} style={{ textAlign: 'center', background: 'var(--surface)', padding: '1rem', borderRadius: '0.75rem' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        {translateScoreKey(key)}
                      </div>
                      <div style={{
                        fontSize: '1.8rem',
                        fontWeight: 700,
                        color: value >= 70 ? 'var(--success-color)' : value >= 50 ? 'var(--warning-color)' : 'var(--danger-color)',
                      }}>
                        {value}%
                      </div>
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ background: 'var(--background)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            background: value >= 70 ? 'var(--success-color)' : value >= 50 ? 'var(--warning-color)' : 'var(--danger-color)',
                            height: '100%',
                            width: `${value}%`,
                            transition: 'width 0.5s ease',
                          }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {similar.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🔗</span> Produse Similare
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {similar.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        background: 'var(--background)',
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        border: '1px solid var(--border-color)',
                      }}
                      onClick={() => onSimilarClick(p.id)}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary-color)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <img
                        src={p.image}
                        style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '0.5rem', marginBottom: '0.75rem' }}
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/200x120/1e293b/6366f1?text=Produs' }}
                        alt={p.title}
                      />
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        {storeEmoji[p.store] || '🏪'} {p.store}
                      </div>
                      <div style={{
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.3,
                      }}>
                        {p.title}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, color: 'var(--success-color)', fontSize: '1.1rem' }}>
                          {formatPrice(p.price)}
                        </div>
                        <div style={{ color: 'var(--warning-color)', fontSize: '0.9rem' }}>
                          {generateStars(p.rating)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', paddingTop: '1.5rem', borderTop: '2px solid var(--border-color)' }}>
              <div style={{ flex: 1, textAlign: 'center', background: 'var(--background)', padding: '1.5rem', borderRadius: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Preț</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--success-color)' }}>
                  {formatPrice(product.price)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Lei moldovenești</div>
              </div>
              <button
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
                  color: 'white',
                  border: 'none',
                  padding: '1.5rem',
                  borderRadius: '1rem',
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(99, 102, 241, 0.3)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                onClick={() => window.open(product.productUrl || product.storeUrl, '_blank')}
              >
                {storeEmoji[product.store] || '🏪'} Vezi în {product.store} →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
