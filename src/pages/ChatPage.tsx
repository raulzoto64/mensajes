import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import BottomNav from '../components/BottomNav'
import ChatWindow from '../components/ChatWindow'
import DmChatWindow from '../components/DmChatWindow'
import MessageInput from '../components/MessageInput'
import AdminPanel from '../components/AdminPanel'
import GroupMembersPanel from '../components/GroupMembersPanel'
import StoriesTab from '../components/StoriesTab'
import StoryViewer from '../components/StoryViewer'
import StoryCreator from '../components/StoryCreator'
import CallsTab from '../components/CallsTab'
import PermissionsRequest from '../components/PermissionsRequest'
import { useActivityHeartbeat } from '../lib/realtime'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { isNative } from '../lib/capacitor'
import { useNotifications } from '../lib/notifications'

type Tab = 'chats' | 'groups' | 'stories' | 'calls'
type GroupView = { id: string; name: string }
type DmView = { conversationId: string; otherUserId: string; otherAlias: string }

export default function ChatPage() {
  const { user } = useAuth()
  useActivityHeartbeat(user?.id ?? null)
  const notifications = useNotifications()
  const [activeTab, setActiveTab] = useState<Tab>('chats')
  const [groupView, setGroupView] = useState<GroupView | null>(null)
  const [dmView, setDmView] = useState<DmView | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [showPermissions, setShowPermissions] = useState(false)
  const [storyViewerStory, setStoryViewerStory] = useState<any>(null)
  const [storyViewerIndex, setStoryViewerIndex] = useState(0)
  const [allStories, setAllStories] = useState<any[]>([])
  const [showStoryCreator, setShowStoryCreator] = useState(false)
  const [unreadChats, setUnreadChats] = useState(0)
  const [unreadGroups, setUnreadGroups] = useState(0)
  const [storyCount, setStoryCount] = useState(0)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Load unread counts for bottom nav
  useEffect(() => {
    if (!user) return
    loadUnreadCounts()
    const channel = supabase
      .channel('nav-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadUnreadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, loadUnreadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, loadStoryCount)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function loadUnreadCounts() {
    if (!user) return
    // DM unread
    const { data: convs } = await supabase
      .from('direct_conversations')
      .select('id')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    const convIds = (convs ?? []).map((c: any) => c.id)
    let dmUnread = 0
    if (convIds.length) {
      const { data: dmMsgs } = await supabase
        .from('direct_messages')
        .select('id, conversation_id, sender_id')
        .in('conversation_id', convIds)
        .eq('is_deleted', false)
      const msgIds = (dmMsgs ?? []).map((m: any) => m.id)
      const { data: viewed } = msgIds.length
        ? await supabase.from('direct_message_views').select('message_id').in('message_id', msgIds).eq('user_id', user.id)
        : { data: [] }
      const viewedSet = new Set((viewed ?? []).map((v: any) => v.message_id))
      dmUnread = (dmMsgs ?? []).filter((m: any) => m.sender_id !== user.id && !viewedSet.has(m.id)).length
    }

    // Group unread
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
    const groupIds = (memberships ?? []).map((m: any) => m.group_id)
    let groupUnread = 0
    if (groupIds.length) {
      const { data: gMsgs } = await supabase
        .from('messages')
        .select('id, group_id, sender_id')
        .in('group_id', groupIds)
        .eq('is_deleted', false)
      const gMsgIds = (gMsgs ?? []).map((m: any) => m.id)
      const { data: gViewed } = gMsgIds.length
        ? await supabase.from('message_views').select('message_id').in('message_id', gMsgIds).eq('user_id', user.id)
        : { data: [] }
      const gViewedSet = new Set((gViewed ?? []).map((v: any) => v.message_id))
      groupUnread = (gMsgs ?? []).filter((m: any) => m.sender_id !== user.id && !gViewedSet.has(m.id)).length
    }

    setUnreadChats(dmUnread)
    setUnreadGroups(groupUnread)
  }

  async function loadStoryCount() {
    const now = new Date().toISOString()
    const { count } = await supabase
      .from('stories')
      .select('id', { count: 'exact', head: true })
      .gt('expires_at', now)
    setStoryCount(count ?? 0)
  }

  useEffect(() => { loadStoryCount() }, [user])

  // Show permissions on first visit
  useEffect(() => {
    if (!user) return
    const shown = localStorage.getItem('ephemera_permissions_shown')
    if (!shown) {
      setTimeout(() => setShowPermissions(true), 2000)
      localStorage.setItem('ephemera_permissions_shown', '1')
    }
  }, [user])

  // Share link ?grupo=
  useEffect(() => {
    if (!user) return
    const grupo = new URLSearchParams(window.location.search).get('grupo')
    if (!grupo) return
    supabase.from('groups').select('id, name').eq('id', grupo).maybeSingle().then(({ data }) => {
      if (!data) return
      supabase.from('group_members').upsert({ group_id: data.id, user_id: user.id }).then(() => {
        handleSelectGroup(data.id, data.name)
        window.history.replaceState({}, '', window.location.pathname)
      })
    })
  }, [user])

  // Push notification deep link ?dm=
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
    setShowMembers(false)
    if (isMobile) setSidebarOpen(false)
  }

  function handleSelectDm(conversationId: string, otherUserId: string, otherAlias: string) {
    setDmView({ conversationId, otherUserId, otherAlias })
    setGroupView(null)
    setShowMembers(false)
    if (isMobile) setSidebarOpen(false)
  }

  function handleSent() {
    setRefreshKey((k) => k + 1)
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    if (tab !== 'chats') setDmView(null)
    if (tab !== 'groups') setGroupView(null)
  }

  const unreadNotificationCount = notifications.filter((n) => !n.read).length

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
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

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Sidebar (hidden on mobile unless open) */}
        <div
          style={{
            position: isMobile ? 'fixed' : 'relative',
            left: isMobile ? (sidebarOpen ? '0' : '-288px') : 'auto',
            top: 0,
            height: '100%',
            zIndex: isMobile ? 50 : 'auto',
            transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
            paddingBottom: isNative() ? '64px' : '60px',
          }}
        >
          <Sidebar
            activeGroupId={groupView?.id ?? null}
            activeDmId={dmView?.conversationId ?? null}
            onSelectGroup={(id, name) => { handleSelectGroup(id, name); setActiveTab('groups') }}
            onSelectDm={handleSelectDm}
            onAdminPanel={() => setShowAdmin(true)}
          />
        </div>

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {activeTab === 'chats' && dmView ? (
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
          ) : activeTab === 'groups' && groupView ? (
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
          ) : activeTab === 'stories' ? (
            <StoriesTab
              onViewStory={(story) => {
                setStoryViewerStory(story)
                setStoryViewerIndex(0)
              }}
              onCreateStory={() => setShowStoryCreator(true)}
            />
          ) : activeTab === 'calls' ? (
            <CallsTab onCallGroup={(id, name) => { handleSelectGroup(id, name); setActiveTab('groups') }} />
          ) : (
            <TabEmptyState
              tab={activeTab}
              isAdmin={user?.is_admin ?? false}
              onAdminPanel={() => setShowAdmin(true)}
              onMenuToggle={() => setSidebarOpen(true)}
              isMobile={isMobile}
              unreadNotificationCount={unreadNotificationCount}
              onOpenNotifications={() => {}}
            />
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        active={activeTab}
        onTabChange={handleTabChange}
        unreadChats={unreadChats}
        unreadGroups={unreadGroups}
        storyCount={storyCount}
        missedCalls={0}
      />

      {/* Overlays */}
      {showAdmin && <AdminPanel initialTab="approvals" onClose={() => setShowAdmin(false)} />}
      {showMembers && groupView && (
        <GroupMembersPanel groupId={groupView.id} onClose={() => setShowMembers(false)} />
      )}
      {showPermissions && <PermissionsRequest onClose={() => setShowPermissions(false)} />}
      {showStoryCreator && (
        <StoryCreator onClose={() => setShowStoryCreator(false)} onCreated={loadStoryCount} />
      )}
      {storyViewerStory && (
        <StoryViewer
          story={storyViewerStory}
          allStories={allStories}
          currentIndex={storyViewerIndex}
          onClose={() => setStoryViewerStory(null)}
          onNext={() => setStoryViewerIndex((i) => Math.min(i + 1, allStories.length - 1))}
          onPrev={() => setStoryViewerIndex((i) => Math.max(i - 1, 0))}
        />
      )}
    </div>
  )
}

function TabEmptyState({
  tab,
  isAdmin,
  onAdminPanel,
  onMenuToggle,
  isMobile,
  unreadNotificationCount,
  onOpenNotifications,
}: {
  tab: Tab
  isAdmin: boolean
  onAdminPanel: () => void
  onMenuToggle: () => void
  isMobile: boolean
  unreadNotificationCount: number
  onOpenNotifications: () => void
}) {
  const labels: Record<Tab, { title: string; subtitle: string; icon: string; features: string[] }> = {
    chats: {
      title: 'Mensajes directos',
      subtitle: 'Busca un usuario con @alias para chatear',
      icon: '💬',
      features: ['TEXTO', 'AUDIO', 'VIDEO', 'GIFS', 'EMOJIS'],
    },
    groups: {
      title: 'Grupos',
      subtitle: 'Crea o únete a un grupo para empezar',
      icon: '👥',
      features: ['CREAR', 'UNIRSE', 'GRUPOS'],
    },
    stories: {
      title: 'Historias',
      subtitle: 'Comparte momentos que desaparecen en 24 horas',
      icon: '📖',
      features: ['FOTOS', 'VIDEOS', '24H', 'CAPTIONS'],
    },
    calls: {
      title: 'Llamadas',
      subtitle: 'Llamadas de audio en grupo',
      icon: '📞',
      features: ['AUDIO', 'GRUPO', 'GRATIS', 'WEBRTC'],
    },
  }

  const info = labels[tab]

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

      <div style={{ fontSize: '48px', position: 'relative' }}>{info.icon}</div>

      <div style={{ textAlign: 'center', position: 'relative', padding: '0 24px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: '#e8e8f0', letterSpacing: '-0.5px' }}>
          {info.title}
        </h2>
        <p style={{ margin: 0, color: '#6b6b8a', fontSize: '13px', maxWidth: '280px' }}>
          {info.subtitle}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', position: 'relative', padding: '0 16px' }}>
        {info.features.map((feat) => (
          <span
            key={feat}
            style={{
              padding: '4px 10px',
              background: 'rgba(139,92,246,0.06)',
              border: '1px solid rgba(139,92,246,0.12)',
              borderRadius: '16px',
              fontSize: '10px',
              color: '#6b6b8a',
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {feat}
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
