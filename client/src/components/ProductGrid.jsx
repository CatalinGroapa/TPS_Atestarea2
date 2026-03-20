import React from 'react'
import ProductCard from './ProductCard'

export default function ProductGrid({
  products,
  wishlist,
  onProductClick,
  onWishlistToggle,
  formatPrice,
  generateStars,
  recommendationEngine,
}) {
  function isInWishlist(productId) {
    return wishlist.some((item) => item.id === productId)
  }

  return (
    <div id="productGrid" className="product-grid">
      {products.map((product, index) => {
        const reasons = recommendationEngine
          ? recommendationEngine.generateExplanation(product)
          : ['Produs recomandat']

        return (
          <ProductCard
            key={product.id}
            product={product}
            rank={index + 1}
            isWishlisted={isInWishlist(product.id)}
            onDetailsClick={onProductClick}
            onWishlistToggle={onWishlistToggle}
            formatPrice={formatPrice}
            generateStars={generateStars}
            reasons={reasons}
          />
        )
      })}
    </div>
  )
}
