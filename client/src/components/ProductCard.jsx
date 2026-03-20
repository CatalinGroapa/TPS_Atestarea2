import React from 'react'

const storeEmoji = {
  Darwin: '🦎',
  Cactus: '🌵',
  Bomba: '💣',
  PandaShop: '🐼',
}

export default function ProductCard({
  product,
  rank,
  isWishlisted,
  onDetailsClick,
  onWishlistToggle,
  formatPrice,
  generateStars,
  reasons,
}) {
  const scoreColor =
    product.recommendationScore >= 80
      ? '#10b981'
      : product.recommendationScore >= 60
        ? '#f59e0b'
        : '#6366f1'

  function handleCardClick(e) {
    if (e.target.closest('.product-btn') || e.target.closest('.wishlist-btn')) return
    const url = product.productUrl || product.storeUrl
    if (url) window.open(url, '_blank')
  }

  return (
    <div className="product-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      <div className="product-badge" style={{ background: scoreColor }}>
        <span>🏆 #{rank}</span>
        <span>{product.recommendationScore}/100</span>
      </div>
      <button
        className={`wishlist-btn${isWishlisted ? ' active' : ''}`}
        title={isWishlisted ? 'Elimină din favorite' : 'Adaugă la favorite'}
        onClick={(e) => { e.stopPropagation(); onWishlistToggle(product) }}
      >
        {isWishlisted ? '❤️' : '🤍'}
      </button>
      <img
        src={product.image}
        alt={product.title}
        className="product-image"
        onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300/1e293b/6366f1?text=Produs' }}
      />
      <div className="product-content">
        <span className="product-store">{storeEmoji[product.store] || '🏪'} {product.store}</span>
        <h3 className="product-title">{product.title}</h3>
        <div className="product-rating">
          <span className="stars">{generateStars(product.rating)}</span>
          <span className="rating-text">
            {Number(product.rating || 0).toFixed(1)} ({product.reviewCount || 0} recenzii)
          </span>
        </div>
        <div className="product-features">
          {(reasons || []).slice(0, 2).map((reason, i) => (
            <span key={i} className="feature-tag">✓ {reason}</span>
          ))}
        </div>
        {!product.inStock && (
          <div style={{ color: 'var(--danger-color)', fontWeight: 600, marginTop: '0.5rem' }}>
            ⚠️ Indisponibil
          </div>
        )}
        <div className="product-footer">
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Preț</div>
            <span className="product-price">{formatPrice(product.price)}</span>
          </div>
          <button
            className="product-btn"
            onClick={(e) => { e.stopPropagation(); onDetailsClick(product.id) }}
          >
            Detalii →
          </button>
        </div>
      </div>
    </div>
  )
}
