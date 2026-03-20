import React from 'react'

export default function WishlistModal({ wishlist, onClose, onRemove, onClearAll, formatPrice }) {
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
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ❤️ Lista de Favorite ({wishlist.length})
            </h2>

            {wishlist.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                Nu ai produse în lista de favorite!
              </p>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {wishlist.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        gap: '1rem',
                        padding: '1rem',
                        background: 'var(--card-bg)',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        style={{
                          width: '80px',
                          height: '80px',
                          objectFit: 'contain',
                          borderRadius: '0.5rem',
                          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                        }}
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/80x80/1e293b/6366f1?text=Produs' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{item.title}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{item.store}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                          {formatPrice(item.price)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button
                          onClick={() => window.open(item.productUrl || item.link || item.storeUrl || '#', '_blank')}
                          style={{
                            background: 'var(--primary-color)',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Vezi Produs
                        </button>
                        <button
                          onClick={() => onRemove(item)}
                          style={{
                            background: 'var(--danger-color)',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                          }}
                        >
                          Elimină
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={onClearAll}
                  style={{
                    marginTop: '1.5rem',
                    background: 'var(--danger-color)',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Șterge toate favoritele
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
