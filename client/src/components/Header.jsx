import React from 'react'

export default function Header({ user, wishlistCount, onWishlistClick, onLogout }) {
  const displayName = user?.displayName || user?.email || 'Utilizator'

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-logo" href="#">
          <img
            src="/images/logo.svg"
            alt="PulsePrice"
            className="site-logo__img"
          />
        </a>

        <div className="site-header__actions">
          <div className="store-badges">
            <span className="store-badge">🦎 Darwin</span>
            <span className="store-badge">🌵 Cactus</span>
            <span className="store-badge">💣 Bomba</span>
            <span className="store-badge">🐼 PandaShop</span>
          </div>
          <div className="header-user">
            <span id="currentUserName" className="current-user">Cont: {displayName}</span>
            <button
              onClick={onWishlistClick}
              className="wishlist-header-btn"
              title="Lista de favorite"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span id="wishlistCount">{wishlistCount}</span>
            </button>
            <button className="logout-btn" onClick={onLogout}>
              Ieșire
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
