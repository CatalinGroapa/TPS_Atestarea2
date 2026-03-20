import React, { useState, useRef, useEffect } from 'react'

export default function SearchBar({
  query,
  onQueryChange,
  onSearch,
  searchHistory,
  onClearHistory,
  onHistoryItemClick,
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleMouseDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      setShowDropdown(false)
      onSearch()
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      inputRef.current?.blur()
    }
  }

  function handleFocus() {
    if (searchHistory.length > 0) {
      setShowDropdown(true)
    }
  }

  function handleHistoryClick(item) {
    onHistoryItemClick(item.query)
    setTimeout(() => setShowDropdown(false), 80)
  }

  function handleClearHistory() {
    onClearHistory()
    setTimeout(() => setShowDropdown(false), 80)
  }

  function handlePillClick(term) {
    onQueryChange(term)
    onSearch(term)
  }

  function formatTimeAgo(timestamp) {
    const now = new Date()
    const date = new Date(timestamp)
    const diffInSeconds = Math.floor((now - date) / 1000)
    if (diffInSeconds < 60) return 'acum'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ore`
    return `${Math.floor(diffInSeconds / 86400)} zile`
  }

  return (
    <section className="search-hero">
      <div className="search-hero__inner">
        <p className="search-hero__eyebrow">Inteligență Artificială · Prețuri Moldova</p>
        <h1 className="search-hero__title">Găsește cel mai bun preț</h1>
        <p className="search-hero__subtitle">
          Comparăm automat produsele din <strong>4 magazine</strong> și îți oferim cele mai bune recomandări.
        </p>

        <div className="search-bar-wrapper" id="searchBarWrapper" ref={wrapperRef}>
          <div className="search-bar" id="searchBar">
            <svg
              className="search-bar__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              id="searchInput"
              className="search-bar__input"
              placeholder="Caută produs (ex: iPhone 15, laptop, televizor…)"
              autoComplete="off"
              spellCheck="false"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
            />
            <button
              id="searchBtn"
              className="search-bar__btn"
              onClick={() => { setShowDropdown(false); onSearch() }}
            >
              <span>Caută</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {showDropdown && searchHistory.length > 0 && (
            <div id="searchHistory" className="search-history-dropdown">
              <div className="history-header">
                <span className="history-header__title">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Căutări recente
                </span>
                <button
                  className="clear-history-btn"
                  onMouseDown={(e) => { e.preventDefault(); handleClearHistory() }}
                >
                  Șterge tot
                </button>
              </div>
              <div className="history-list">
                {searchHistory.map((item, i) => (
                  <button
                    key={i}
                    className="history-item"
                    onMouseDown={(e) => { e.preventDefault(); handleHistoryClick(item) }}
                  >
                    <span className="history-icon">🔍</span>
                    <span className="history-query">{item.query}</span>
                    <span className="history-time">{formatTimeAgo(item.timestamp)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="search-pills">
          <span className="search-pills__label">Popular:</span>
          {[
            { label: '💻 Laptop', term: 'laptop' },
            { label: '📱 iPhone', term: 'iPhone' },
            { label: '📱 Samsung', term: 'Samsung' },
            { label: '📺 Televizor', term: 'televizor' },
            { label: '🎧 Căști', term: 'căști' },
            { label: '📱 Tabletă', term: 'tabletă' },
          ].map(({ label, term }) => (
            <button
              key={term}
              className="pill"
              onClick={() => handlePillClick(term)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
