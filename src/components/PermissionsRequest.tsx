import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Permission = {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  granted: boolean
  canRequest: boolean
}

type Props = {
  onClose: () => void
}

export default function PermissionsRequest({ onClose }: Props) {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<Permission[]>([
    {
      id: 'camera',
      name: 'Cámara',
      description: 'Envía fotos y videos',
      granted: false,
      canRequest: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      ),
    },
    {
      id: 'microphone',
      name: 'Micrófono',
      description: 'Envía audios y graba videos',
      granted: false,
      canRequest: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      ),
    },
    {
      id: 'location',
      name: 'Ubicación',
      description: 'Comparte tu ubicación en tiempo real',
      granted: false,
      canRequest: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
    },
  ])
  const [requesting, setRequesting] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(true)

  useEffect(() => {
    checkPermissions()
  }, [])

  async function checkPermissions() {
    console.log('[PERMISO] verificando estados de permisos...')
    const camState = typeof navigator.mediaDevices !== 'undefined' ? 'granted' : 'denied'
    const micState = typeof navigator.mediaDevices !== 'undefined' ? 'granted' : 'denied'

    let locState = 'denied'
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
        })
        locState = 'granted'
      } catch {
        locState = 'prompt'
      }
    }

    setPermissions((prev) =>
      prev.map((p) => {
        if (p.id === 'camera') return { ...p, granted: camState === 'granted' }
        if (p.id === 'microphone') return { ...p, granted: micState === 'granted' }
        if (p.id === 'location') return { ...p, granted: locState === 'granted' }
        return p
      }),
    )
  }

  async function requestPermission(id: string) {
    setRequesting(id)
    setStatusMsg(`Solicitando ${id}...`)
    console.log('[PERMISO] solicitando:', id)
    try {
      if (id === 'camera' || id === 'microphone') {
        const constraints: MediaStreamConstraints = id === 'camera'
          ? { video: true }
          : { audio: true }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        console.log('[PERMISO] media (' + id + ') resultado: concedido')
        stream.getTracks().forEach((t) => t.stop())
        setStatusMsg(id === 'camera' ? 'Cámara concedida ✓' : 'Micrófono concedido ✓')
        setPermissions((prev) => prev.map((p) => p.id === id ? { ...p, granted: true } : p))
      } else if (id === 'location') {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject)
        })
        console.log('[PERMISO] ubicación resultado: concedido')
        setStatusMsg('Ubicación concedida ✓')
        setPermissions((prev) => prev.map((p) => p.id === id ? { ...p, granted: true } : p))
      }
    } catch (e: any) {
      console.error('[PERMISO] error en ' + id + ':', e)
      setStatusMsg(id + ': denegado o error')
      // Permission denied
    }
    setRequesting(null)
  }

  async function requestAll() {
    for (const p of permissions) {
      if (!p.granted && p.canRequest) {
        await requestPermission(p.id)
      }
    }
  }

  const allGranted = permissions.every((p) => p.granted)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          overflow: 'hidden',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        {/* Status banner */}
        {statusMsg && (
          <div style={{ padding: '8px 16px', background: '#f0f2f5', borderBottom: '1px solid #e5e7eb', fontSize: '12px', color: '#111b21', textAlign: 'center', fontFamily: "'DM Mono', monospace" }}>
            {statusMsg}
          </div>
        )}
        {/* Header */}
        <div style={{ padding: '20px 20px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔐</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#111b21', marginBottom: '4px' }}>
            Permisos necesarios
          </div>
          <div style={{ fontSize: '12px', color: '#8696a0', lineHeight: '1.5' }}>
            Para una mejor experiencia, necesitamos acceso a estas funciones
          </div>
        </div>

        {/* Permissions list */}
        <div style={{ padding: '0 16px 12px' }}>
          {permissions.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                marginBottom: '4px',
                background: '#f0f2f5',
                borderRadius: '10px',
                border: `1px solid ${p.granted ? 'rgba(34,197,94,0.2)' : '#e5e7eb'}`,
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: p.granted ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {p.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#111b21' }}>{p.name}</div>
                <div style={{ fontSize: '11px', color: '#8696a0' }}>{p.description}</div>
              </div>
              {p.granted ? (
                <div style={{ color: '#25d366', fontSize: '18px' }}>✓</div>
              ) : (
                <button
                  onClick={() => requestPermission(p.id)}
                  disabled={requesting === p.id}
                  style={{
                    padding: '5px 12px',
                    background: 'rgba(0,168,132,0.1)',
                    border: '1px solid rgba(0,168,132,0.2)',
                    borderRadius: '6px',
                    color: '#00a884',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  {requesting === p.id ? '...' : 'Permitir'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px 16px', display: 'flex', gap: '8px' }}>
          {!allGranted && (
            <button
              onClick={requestAll}
              style={{
                flex: 1,
                padding: '10px',
                background: '#00a884',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Permitir todo
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px',
              background: allGranted ? '#25d366' : 'transparent',
              border: allGranted ? 'none' : '1px solid #e5e7eb',
              borderRadius: '10px',
              color: allGranted ? '#fff' : '#8696a0',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            {allGranted ? 'Listo' : 'Ahora no'}
          </button>
        </div>
      </div>
    </div>
  )
}
