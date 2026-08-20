import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import DmChatWindow from '../components/DmChatWindow'
import MessageInput from '../components/MessageInput'
import AdminPanel from '../components/AdminPanel'
import GroupMembersPanel from '../components/GroupMembersPanel'
import { useActivityHeartbeat } from '../lib/realtime'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type GroupView = { id: string; name: string }
type DmView = { conversationId: string; otherUserId: string; otherAlias: string }

export default function ChatPage() {
  const { user } = useAuth()
  useActivityHeartbeat(user?.id ?? null)
  const [groupView, setGroupView] = useState<GroupView | null>(null)
  const [dmView, setDmView] = useState<DmView | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Al llegar por un enlace compartido ?grupo=ID → unirse y abrir el grupo
  useEffect(() => {
    if (!user) return
    const grupo = new URLSearchParams(window.location.search).get('grupo')
    if (!grupo) return
    supabase
      .from('groups')
      .select('id, name')
      .eq('id', grupo)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        supabase
          .from('group_members')
          .upsert({ group_id: data.id, user_id: user.id })
          .then(() => {
            handleSelectGroup(data.id, data.name)
            window.history.replaceState({}, '', window.location.pathname)
          })
      })
  }, [user])

  // Al llegar por una notificación push de mensaje directo ?dm=CONVID&u=OTHER&alias=...
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    const conv = params.get('dm')
    const other = params.get('u')
    const alias = params.get('alias')
    if (!conv || !other) return
    handleSelectDm(conv, other, alias ?? 'usuario')
    window.history.replaceState({}, '', window.location.pathname)
  }, [user])

  function handleSelectGroup(id: string, name: string) {
    setGroupView({ id, name })
    setDmView(null)
    if (isMobile) setSidebarOpen(false)
  }

  function handleSelectDm(conversationId: string, otherUserId: string, otherAlias: string) {
    setDmView({ conversationId, otherUserId, otherAlias })
    setGroupView(null)
    if (isMobile) setSidebarOpen(false)
  }

  function handleSent() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        background: '#070711',
        fontFamily: "'Outfit', sans-serif",
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7,7,17,0.7)',
            zIndex: 40,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: isMobile ? 'fixed' : 'relative',
          left: isMobile ? (sidebarOpen ? '0' : '-288px') : 'auto',
          top: 0,
          height: '100%',
          zIndex: isMobile ? 50 : 'auto',
          transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
        }}
      >
        <Sidebar
          activeGroupId={groupView?.id ?? null}
          activeDmId={dmView?.conversationId ?? null}
          onSelectGroup={handleSelectGroup}
          onSelectDm={handleSelectDm}
          onAdminPanel={() => setShowAdmin(true)}
        />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {dmView ? (
          <>
            <DmChatWindow
              conversationId={dmView.conversationId}
              otherUserId={dmView.otherUserId}
              otherAlias={dmView.otherAlias}
              onMenuToggle={() => setSidebarOpen(true)}
              isMobile={isMobile}
            />
            <MessageInput conversationId={dmView.conversationId} onSent={handleSent} isMobile={isMobile} />
          </>
        ) : groupView ? (
          <>
            <ChatWindow
              groupId={groupView.id}
              groupName={groupView.name}
              refresh={refreshKey}
              onMenuToggle={() => setSidebarOpen(true)}
              onShowMembers={() => setShowMembers(true)}
              isMobile={isMobile}
            />
            <MessageInput groupId={groupView.id} onSent={handleSent} isMobile={isMobile} />
          </>
        ) : (
          <EmptyState
            isAdmin={user?.is_admin ?? false}
            onAdminPanel={() => setShowAdmin(true)}
            onMenuToggle={() => setSidebarOpen(true)}
            isMobile={isMobile}
          />
        )}
      </div>

      {showAdmin && <AdminPanel initialTab="approvals" onClose={() => setShowAdmin(false)} />}
      {showMembers && groupView && (
        <GroupMembersPanel groupId={groupView.id} onClose={() => setShowMembers(false)} />
      )}
    </div>
  )
}

function EmptyState({
  isAdmin,
  onAdminPanel,
  onMenuToggle,
  isMobile,
}: {
  isAdmin: boolean
  onAdminPanel: () => void
  onMenuToggle: () => void
  isMobile: boolean
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: '#070711',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isMobile && (
        <button
          onClick={onMenuToggle}
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            background: '#14142a',
            border: '1px solid #1e1e3a',
            borderRadius: '10px',
            width: '38px',
            height: '38px',
            color: '#6b6b8a',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          ☰
        </button>
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div
        style={{
          width: '64px',
          height: '64px',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(34,211,238,0.1))',
          border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '30px',
          color: '#8b5cf6',
          position: 'relative',
          boxShadow: '0 0 40px rgba(139,92,246,0.1)',
        }}
      >
        ◈
      </div>

      <div style={{ textAlign: 'center', position: 'relative', padding: '0 24px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: '700', color: '#e8e8f0', letterSpacing: '-0.5px' }}>
          Selecciona un grupo o un mensaje directo
        </h2>
        <p style={{ margin: 0, color: '#6b6b8a', fontSize: '14px', maxWidth: '300px' }}>
          Elige un chat en la barra lateral o busca un usuario con @alias para enviarle un mensaje privado
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', position: 'relative', padding: '0 16px' }}>
        {['Texto · Audio · Video', 'GIFs · Emojis', 'Grupos', 'Mensajes privados'].map((feat) => (
          <span
            key={feat}
            style={{
              padding: '5px 12px',
              background: 'rgba(139,92,246,0.06)',
              border: '1px solid rgba(139,92,246,0.12)',
              borderRadius: '20px',
              fontSize: '11px',
              color: '#6b6b8a',
              fontFamily: "'DM Mono', monospace",
              whiteSpace: 'nowrap',
            }}
          >
            {feat.toUpperCase()}
          </span>
        ))}
      </div>

      {isAdmin && (
        <button
          onClick={onAdminPanel}
          style={{
            position: 'relative',
            marginTop: '8px',
            padding: '8px 20px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '10px',
            color: '#f87171',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          Abrir panel de administrador
        </button>
      )}
    </div>
  )
}