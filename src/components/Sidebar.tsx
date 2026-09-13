import { useState, useEffect } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { unsubscribePush } from '../lib/push'
import { checkForUpdate } from '../lib/updater'

type Props = {
  activeGroupId: string | null
  activeDmId: string | null
  onSelectGroup: (id: string, name: string) => void
  onSelectDm: (conversationId: string, otherUserId: string, otherAlias: string) => void
  onAdminPanel: () => void
}

export default function Sidebar({ activeGroupId, activeDmId, onSelectGroup, onSelectDm, onAdminPanel }: Props) {
  const { user, logout } = useAuth()
  const [supabaseMissing] = useState(!supabaseConfigured)
  const [updateInfo, setUpdateInfo] = useState<{ version: string; downloadUrl: string } | null>(null)

  useEffect(() => {
    checkForUpdate().then((info) => {
      if (info.needsUpdate && info.downloadUrl) {
        setUpdateInfo({ version: info.version, downloadUrl: info.downloadUrl })
      }
    })
  }, [])

  return (
    <div
      style={{
        width: '280px',
        minWidth: '280px',
        height: '100%',
        background: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {/* Config warning */}
      {supabaseMissing && (
        <div style={{ margin: '8px', padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', fontSize: '11px', color: '#fbbf24', fontFamily: "'DM Mono', monospace", lineHeight: '1.5' }}>
          ⚠ SUPABASE NO CONFIGURADO<br />
          <span style={{ color: '#8696a0', fontFamily: "'Outfit', sans-serif", fontSize: '11px' }}>
            Crea un .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
          </span>
        </div>
      )}

      {/* Update banner */}
      {updateInfo && (
        <div style={{ margin: '8px', padding: '10px 12px', background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(0,136,204,0.2)', borderRadius: '10px', fontSize: '11px', color: '#0088cc', fontFamily: "'Outfit', sans-serif", lineHeight: '1.5' }}>
          <div style={{ fontWeight: '700', marginBottom: '6px' }}>Nueva versión v{updateInfo.version}</div>
          <button
            onClick={() => window.open(updateInfo.downloadUrl, '_blank')}
            style={{ width: '100%', padding: '6px', background: 'rgba(0,136,204,0.12)', border: '1px solid rgba(0,136,204,0.25)', borderRadius: '7px', color: '#0088cc', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
          >
            Actualizar ahora
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '30px', height: '30px', background: 'linear-gradient(135deg, #00a884, #0088cc)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' }}>
            ◈
          </div>
          <span style={{ fontWeight: '700', fontSize: '15px', color: '#111b21', letterSpacing: '-0.3px' }}>
            Ephemera
          </span>
        </div>

        {/* User row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#f0f2f5', borderRadius: '8px' }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '50%',
            background: 'rgba(0,168,132,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', color: '#00a884', fontWeight: '700', flexShrink: 0,
          }}>
            {user?.alias?.[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: '13px', color: '#667781', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{user?.alias}
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Logout */}
      <div style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
        <button
          onClick={() => {
            if (user) unsubscribePush(user.id)
            logout()
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '9px',
            background: 'rgba(234,67,53,0.06)',
            border: '1px solid rgba(234,67,53,0.18)',
            borderRadius: '9px',
            color: '#ea4335',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif",
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(234,67,53,0.12)'; e.currentTarget.style.borderColor = 'rgba(234,67,53,0.3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(234,67,53,0.06)'; e.currentTarget.style.borderColor = 'rgba(234,67,53,0.18)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
