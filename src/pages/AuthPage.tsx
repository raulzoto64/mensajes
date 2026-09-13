import { useState } from 'react'
import { register, login } from '../lib/auth'
import { useAuth } from '../contexts/AuthContext'

export default function AuthPage() {
  const { setUser } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [alias, setAlias] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!alias.trim() || !password) return
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const fn = mode === 'login' ? login : register
      const { user, error: err, pending } = mode === 'login' ? await fn(alias, password) : await fn(alias, password, phone || '+51')
      if (err) setError(err)
      else if (pending) {
        setInfo('Ya estás registrado, pídele al administrador que te apruebe el ingreso.')
        setMode('login')
      }
      else if (user) setUser(user)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f0f2f5',
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
            'linear-gradient(rgba(0,168,132,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,168,132,0.04) 1px, transparent 1px)',
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
              background: 'linear-gradient(135deg, #00a884, #0088cc)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px',
              boxShadow: '0 0 40px rgba(0,168,132,0.25)',
            }}
          >
            ◈
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#111b21',
              margin: '0 0 6px',
              letterSpacing: '-0.5px',
            }}
          >
            Ephemera
          </h1>
          <p style={{ color: '#8696a0', fontSize: '14px', margin: 0 }}>
            Mensajes que desaparecen cuando todos los han visto
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '20px',
            padding: '32px',
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              background: '#f0f2f5',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '28px',
            }}
          >
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setInfo(null) }}
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
                  background: mode === m ? '#00a884' : 'transparent',
                  color: mode === m ? '#fff' : '#8696a0',
                }}
              >
                {m === 'login' ? 'Entrar' : 'Registrarse'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8696a0', marginBottom: '8px', fontWeight: '500' }}>
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
                  background: '#f0f2f5',
                  border: '1px solid #e5e7eb',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  color: '#111b21',
                  fontSize: '15px',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#00a884')}
                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#8696a0', marginBottom: '8px', fontWeight: '500' }}>
                  CELULAR
                </label>
                <div style={{ display: 'flex', gap: '0' }}>
                  {/* Country code selector */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#f0f2f5',
                      border: '1px solid #e5e7eb',
                      borderRight: 'none',
                      borderRadius: '10px 0 0 10px',
                      padding: '0 12px',
                      fontSize: '15px',
                      color: '#111b21',
                      fontFamily: "'Outfit', sans-serif",
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>🇵🇪</span>
                    <span style={{ fontWeight: '500' }}>+51</span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="999 888 777"
                    required
                    style={{
                      flex: 1,
                      background: '#f0f2f5',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0 10px 10px 0',
                      padding: '12px 16px',
                      color: '#111b21',
                      fontSize: '15px',
                      fontFamily: "'Outfit', sans-serif",
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#00a884')}
                    onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8696a0', marginBottom: '8px', fontWeight: '500' }}>
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
                    background: '#f0f2f5',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 48px 12px 16px',
                    color: '#111b21',
                    fontSize: '15px',
                    fontFamily: "'Outfit', sans-serif",
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#00a884')}
                  onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
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
                    color: '#8696a0',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#111b21')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#8696a0')}
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
                  color: '#ea4335',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            {info && (
              <div
                style={{
                  background: 'rgba(0,136,204,0.08)',
                  border: '1px solid rgba(0,136,204,0.25)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#0088cc',
                  fontSize: '13px',
                }}
              >
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '4px',
                padding: '13px',
                background: loading ? '#adb5bd' : 'linear-gradient(135deg, #00a884, #7c3aed)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: '600',
                fontFamily: "'Outfit', sans-serif",
                cursor: loading ? 'default' : 'pointer',
                transition: 'opacity 0.2s',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(0,168,132,0.25)',
              }}
            >
              {loading ? '...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#adb5bd', fontSize: '12px', marginTop: '24px', fontFamily: "'DM Mono', monospace" }}>
          TUS DATOS SE ALMACENAN ENCRIPTADOS
        </p>
      </div>
    </div>
  )
}
