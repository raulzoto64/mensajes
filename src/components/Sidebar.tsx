import { useState, useEffect, useRef } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { unsubscribePush } from '../lib/push'
import { checkForUpdate } from '../lib/updater'

type Tab = 'chats' | 'groups' | 'stories' | 'calls' | 'contacts'

type Props = {
  activeGroupId: string | null
  activeDmId: string | null
  activeTab: Tab
  unreadChats: number
  unreadGroups: number
  storyCount: number
  onSelectGroup: (id: string, name: string) => void
  onSelectDm: (conversationId: string, otherUserId: string, otherAlias: string) => void
  onTabChange: (tab: Tab) => void
  onAdminPanel: () => void
  onSettings: () => void
  onPermissions?: () => void
}

export default function Sidebar({ activeGroupId, activeDmId, activeTab, unreadChats, unreadGroups, storyCount, onSelectGroup, onSelectDm, onTabChange, onAdminPanel, onSettings, onPermissions }: Props) {
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

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge: number }[] = [
    {
      id: 'chats', label: 'Chats', badge: unreadChats,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    },
    {
      id: 'groups', label: 'Grupos', badge: unreadGroups,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    },
    {
      id: 'stories', label: 'Historias', badge: storyCount,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><line x1="21.17" y1="8" x2="12" y2="8" /><line x1="3.95" y1="6.06" x2="8.54" y2="14" /><line x1="10.88" y1="21.94" x2="15.46" y2="14" /></svg>,
    },
    {
      id: 'calls', label: 'Llamadas', badge: 0,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
    },
    {
      id: 'contacts', label: 'Contactos', badge: 0,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    },
  ]

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

      {/* Navigation tabs */}
      <div style={{ padding: '8px' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                background: isActive ? 'rgba(0,168,132,0.08)' : 'transparent',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                color: isActive ? '#00a884' : '#667781',
                fontSize: '14px',
                fontWeight: isActive ? '600' : '400',
                fontFamily: "'Outfit', sans-serif",
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f0f2f5' }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ position: 'relative' }}>
                {tab.icon}
                {tab.badge > 0 && (
                  <span style={{
                    position: 'absolute', top: '-6px', right: '-8px',
                    minWidth: '16px', height: '16px',
                    background: '#00a884', borderRadius: '8px',
                    color: '#fff', fontSize: '9px', fontWeight: '700',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px',
                  }}>
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Admin & Settings */}
      <div style={{ padding: '4px 8px' }}>
        {user?.is_admin && (
          <button
            onClick={onAdminPanel}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '10px',
              cursor: 'pointer', color: '#ea4335', fontSize: '14px', fontWeight: '500',
              fontFamily: "'Outfit', sans-serif", textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(234,67,53,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Administrar
          </button>
        )}
        <button
          onClick={onSettings}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '10px',
            cursor: 'pointer', color: '#667781', fontSize: '14px', fontWeight: '500',
            fontFamily: "'Outfit', sans-serif", textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f2f5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Configuración
        </button>
      </div>

      {/* Permissions */}
      <div style={{ padding: '0 8px' }}>
        <button
          onClick={() => onPermissions?.()}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '10px',
            cursor: 'pointer', color: '#f59e0b', fontSize: '14px', fontWeight: '500',
            fontFamily: "'Outfit', sans-serif", textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,158,11,0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Permisos
        </button>
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
