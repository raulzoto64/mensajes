import { useState, useEffect, useRef } from 'react'
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
  const { user, logout, setUser } = useAuth()
  const [supabaseMissing] = useState(!supabaseConfigured)
  const [updateInfo, setUpdateInfo] = useState<{ version: string; downloadUrl: string } | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkForUpdate().then((info) => {
      if (info.needsUpdate && info.downloadUrl) {
        setUpdateInfo({ version: info.version, downloadUrl: info.downloadUrl })
      }
    })
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `avatars/${user.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('media').upload(path, file, {
      contentType: file.type,
      upsert: true,
    })
    if (uploadError) { setUploadingAvatar(false); return }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
    const avatarUrl = urlData.publicUrl

    await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', user.id)

    const updated = { ...user, avatar_url: avatarUrl }
    setUser(updated)
    localStorage.setItem('ephemera_session', JSON.stringify(updated))
    setUploadingAvatar(false)
  }

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

        {/* User row with avatar */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#f0f2f5', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s' }}
          onClick={() => avatarRef.current?.click()}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#f0f2f5')}
        >
          <div style={{ position: 'relative' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: user?.avatar_url ? 'transparent' : 'rgba(0,168,132,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '13px', color: '#00a884', fontWeight: '700' }}>{user?.alias?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <div style={{
              position: 'absolute', bottom: '-1px', right: '-1px',
              width: '14px', height: '14px', borderRadius: '50%',
              background: '#00a884', border: '2px solid #f0f2f5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '8px', color: '#fff',
            }}>
              {uploadingAvatar ? '...' : '📷'}
            </div>
          </div>
          <span style={{ fontSize: '13px', color: '#667781', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{user?.alias}
          </span>
        </div>
        <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
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
