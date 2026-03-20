import React from 'react'

export default function FiltersToolbar({ filters, onChange, resultsCount, show }) {
  if (!show) return null

  return (
    <div className="filters-toolbar" id="filtersToolbar">
      <div className="content-wrap">
        <div className="filters">
          <div className="filter-group">
            <label htmlFor="priceRange" className="filter-group__label">Buget max</label>
            <input
              type="number"
              id="priceRange"
              className="filter-group__input"
              placeholder="MDL"
              min="0"
              step="100"
              value={filters.maxPrice}
              onChange={(e) => onChange({ ...filters, maxPrice: e.target.value })}
            />
          </div>

          <div className="filter-separator"></div>

          <div className="filter-group">
            <label htmlFor="minRating" className="filter-group__label">Rating</label>
            <select
              id="minRating"
              className="filter-group__select"
              value={filters.minRating}
              onChange={(e) => onChange({ ...filters, minRating: e.target.value })}
            >
              <option value="0">Oricare</option>
              <option value="3">3+ ⭐</option>
              <option value="4">4+ ⭐</option>
              <option value="4.5">4.5+ ⭐</option>
            </select>
          </div>

          <div className="filter-separator"></div>

          <div className="filter-group">
            <label htmlFor="sortBy" className="filter-group__label">Sortare</label>
            <select
              id="sortBy"
              className="filter-group__select"
              value={filters.sortBy}
              onChange={(e) => onChange({ ...filters, sortBy: e.target.value })}
            >
              <option value="score">Recomandat</option>
              <option value="price-asc">Preț ↑</option>
              <option value="price-desc">Preț ↓</option>
              <option value="rating">Rating</option>
            </select>
          </div>

          <div className="filter-separator"></div>

          <label className="toggle-label" htmlFor="inStock">
            <input
              type="checkbox"
              id="inStock"
              className="toggle-checkbox"
              checked={filters.inStock}
              onChange={(e) => onChange({ ...filters, inStock: e.target.checked })}
            />
            <span className="toggle-track"><span className="toggle-thumb"></span></span>
            <span className="toggle-text">Doar în stoc</span>
          </label>
        </div>
      </div>
    </div>
  )
}
