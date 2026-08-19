import { useState } from 'react'
import { register, login } from '../lib/auth'
import { useAuth } from '../contexts/AuthContext'

export default function AuthPage() {
  const { setUser } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [alias, setAlias] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!alias.trim() || !password) return
    setError(null)
    setLoading(true)
    try {
      const fn = mode === 'login' ? login : register
      const { user, error: err } = await fn(alias, password)
      if (err) setError(err)
      else if (user) setUser(user)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#070711',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Outfit', sans-serif",
        padding: '24px',
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #8b5cf6, #22d3ee)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px',
              boxShadow: '0 0 40px rgba(139,92,246,0.3)',
            }}
          >
            ◈
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#e8e8f0',
              margin: '0 0 6px',
              letterSpacing: '-0.5px',
            }}
          >
            Ephemera
          </h1>
          <p style={{ color: '#6b6b8a', fontSize: '14px', margin: 0 }}>
            Mensajes que desaparecen cuando todos los han visto
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#0f0f1e',
            border: '1px solid #1e1e3a',
            borderRadius: '20px',
            padding: '32px',
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              background: '#14142a',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '28px',
            }}
          >
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'all 0.2s',
                  background: mode === m ? '#8b5cf6' : 'transparent',
                  color: mode === m ? '#fff' : '#6b6b8a',
                }}
              >
                {m === 'login' ? 'Entrar' : 'Registrarse'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#6b6b8a', marginBottom: '8px', fontWeight: '500' }}>
                ALIAS
              </label>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="tu_alias"
                autoComplete="username"
                required
                style={{
                  width: '100%',
                  background: '#14142a',
                  border: '1px solid #1e1e3a',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  color: '#e8e8f0',
                  fontSize: '15px',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#8b5cf6')}
                onBlur={(e) => (e.target.style.borderColor = '#1e1e3a')}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#6b6b8a', marginBottom: '8px', fontWeight: '500' }}>
                CONTRASEÑA
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  style={{
                    width: '100%',
                    background: '#14142a',
                    border: '1px solid #1e1e3a',
                    borderRadius: '10px',
                    padding: '12px 48px 12px 16px',
                    color: '#e8e8f0',
                    fontSize: '15px',
                    fontFamily: "'Outfit', sans-serif",
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#8b5cf6')}
                  onBlur={(e) => (e.target.style.borderColor = '#1e1e3a')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: '#6b6b8a',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#e8e8f0')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#6b6b8a')}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#f87171',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '4px',
                padding: '13px',
                background: loading ? '#3d3d5c' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: '600',
                fontFamily: "'Outfit', sans-serif",
                cursor: loading ? 'default' : 'pointer',
                transition: 'opacity 0.2s',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(139,92,246,0.3)',
              }}
            >
              {loading ? '...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#3d3d5c', fontSize: '12px', marginTop: '24px', fontFamily: "'DM Mono', monospace" }}>
          TUS DATOS SE ALMACENAN ENCRIPTADOS
        </p>
      </div>
    </div>
  )
}
