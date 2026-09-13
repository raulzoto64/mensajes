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
import ContactsTab from '../components/ContactsTab'
import PermissionsRequest from '../components/PermissionsRequest'
import DmList from '../components/DmList'
import GroupList from '../components/GroupList'
import SettingsPanel from '../components/SettingsPanel'
import { useActivityHeartbeat } from '../lib/realtime'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCall } from '../contexts/CallContext'
import { clearNotificationsForChat } from '../lib/notifications'
import { checkForUpdate } from '../lib/updater'

type Tab = 'chats' | 'groups' | 'stories' | 'calls' | 'contacts' | 'permissions'
type GroupView = { id: string; name: string }
type DmView = { conversationId: string; otherUserId: string; otherAlias: string }

export default function ChatPage() {
  const { user, logout, setUser } = useAuth()
  const { startCall } = useCall()
  useActivityHeartbeat(user?.id ?? null)
  const [activeTab, setActiveTab] = useState<Tab>('chats')
  const [groupView, setGroupView] = useState<GroupView | null>(null)
  const [dmView, setDmView] = useState<DmView | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPhonePopup, setShowPhonePopup] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; downloadUrl: string } | null>(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [storyViewerStory, setStoryViewerStory] = useState<any>(null)
  const [viewerStories, setViewerStories] = useState<any[]>([])
  const [storyViewerIndex, setStoryViewerIndex] = useState(0)
  const [showStoryCreator, setShowStoryCreator] = useState(false)
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)
  const [unreadGroups, setUnreadGroups] = useState(0)
  const [storyCount, setStoryCount] = useState(0)

  useEffect(() => {
    if (!user) return
    if (!user.phone || user.phone.trim() === '') {
      setShowPhonePopup(true)
    } else {
      setShowPhonePopup(false)
    }
    // Check if permissions are granted; if not, show the request
    const notifState = typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    if (notifState !== 'granted') {
      setActiveTab('permissions')
    }
  }, [user])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (!user) return
    loadUnreadCounts()
    const channel = supabase
      .channel('nav-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadUnreadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, loadUnreadCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, loadStoryCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_views' }, loadStoryCount)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function loadUnreadCounts() {
    if (!user) return
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
    if (!user) return
    const now = new Date().toISOString()
    const { data: allStories } = await supabase
      .from('stories')
      .select('id')
      .gt('expires_at', now)
    const storyIds = (allStories ?? []).map((s: any) => s.id)
    if (storyIds.length === 0) { setStoryCount(0); return }
    const { data: viewed } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('user_id', user.id)
      .in('story_id', storyIds)
    const viewedIds = new Set((viewed ?? []).map((v: any) => v.story_id))
    const unviewed = storyIds.filter((id: string) => !viewedIds.has(id))
    setStoryCount(unviewed.length)
  }

  useEffect(() => { loadStoryCount() }, [user])

  useEffect(() => {
    checkForUpdate().then((info) => {
      if (info && info.needsUpdate && info.downloadUrl) setUpdateInfo(info)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    const shown = localStorage.getItem('ephemera_permissions_shown')
    if (!shown) {
      setTimeout(() => setActiveTab('permissions'), 2000)
      localStorage.setItem('ephemera_permissions_shown', '1')
    }
  }, [user])

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

  function handleBack() {
    setGroupView(null)
    setDmView(null)
  }

  function handleSelectGroup(id: string, name: string) {
    setGroupView({ id, name })
    setDmView(null)
    setShowMembers(false)
    clearNotificationsForChat(undefined, id)
    if (isMobile) setSidebarOpen(false)
  }

  function handleSelectDm(conversationId: string, otherUserId: string, otherAlias: string) {
    setDmView({ conversationId, otherUserId, otherAlias })
    setGroupView(null)
    setShowMembers(false)
    clearNotificationsForChat(conversationId)
    if (isMobile) setSidebarOpen(false)
  }

  async function handleMessageContact(otherId: string, otherAlias: string) {
    if (!user) return
    const [a, b] = [user.id, otherId].map((s) => `${s}`).sort()
    let { data: conv } = await supabase
      .from('direct_conversations')
      .select('id')
      .eq('user_a', a)
      .eq('user_b', b)
      .maybeSingle()
    if (!conv) {
      const { data: created } = await supabase
        .from('direct_conversations')
        .insert({ user_a: a, user_b: b })
        .select('id')
        .single()
      conv = created
    }
    if (conv) {
      handleSelectDm(conv.id, otherId, otherAlias)
    }
  }

  function handleSent() {
    setRefreshKey((k) => k + 1)
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    if (tab !== 'chats') setDmView(null)
    if (tab !== 'groups') setGroupView(null)
  }

  // Show chat window if a DM or group is selected
  const showChat = dmView || groupView

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f0f2f5',
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

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Desktop sidebar */}
        {!isMobile && (
          <div
            style={{
              width: '288px',
              height: '100%',
              flexShrink: 0,
              borderRight: '1px solid #e5e7eb',
            }}
          >
            <Sidebar
              activeGroupId={groupView?.id ?? null}
              activeDmId={dmView?.conversationId ?? null}
              activeTab={activeTab}
              unreadChats={unreadChats}
              unreadGroups={unreadGroups}
              storyCount={storyCount}
              onSelectGroup={(id, name) => { handleSelectGroup(id, name); setActiveTab('groups') }}
              onSelectDm={handleSelectDm}
              onTabChange={handleTabChange}
              onAdminPanel={() => setShowAdmin(true)}
              onSettings={() => setShowSettings(true)}
            />
          </div>
        )}

        {/* Mobile sidebar - only on mobile */}
        {isMobile && (
          <div
            style={{
              position: 'fixed',
              left: sidebarOpen ? '0' : '-288px',
              top: 0,
              height: '100%',
              zIndex: 50,
              transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
            }}
          >
            <Sidebar
              activeGroupId={groupView?.id ?? null}
              activeDmId={dmView?.conversationId ?? null}
              activeTab={activeTab}
              unreadChats={unreadChats}
              unreadGroups={unreadGroups}
              storyCount={storyCount}
              onSelectGroup={(id, name) => { handleSelectGroup(id, name); setActiveTab('groups') }}
              onSelectDm={handleSelectDm}
              onTabChange={handleTabChange}
              onAdminPanel={() => setShowAdmin(true)}
              onSettings={() => { setSidebarOpen(false); setShowSettings(true) }}
              onPermissions={() => { setSidebarOpen(false); setActiveTab('permissions') }}
            />
          </div>
        )}

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, paddingBottom: isMobile && !showChat && !showAdmin ? '60px' : '0' }}>
          {/* Active chat view (DM or Group) */}
          {showChat && dmView && (
            <>
              <DmChatWindow
                conversationId={dmView.conversationId}
                otherUserId={dmView.otherUserId}
                otherAlias={dmView.otherAlias}
                onMenuToggle={() => setSidebarOpen(true)}
                onBack={handleBack}
                isMobile={isMobile}
              />
              <MessageInput conversationId={dmView.conversationId} onSent={handleSent} isMobile={isMobile} />
            </>
          )}
          {showChat && groupView && !dmView && (
            <>
              <ChatWindow
                groupId={groupView.id}
                groupName={groupView.name}
                refresh={refreshKey}
                onMenuToggle={() => setSidebarOpen(true)}
                onBack={handleBack}
                onShowMembers={() => setShowMembers(true)}
                isMobile={isMobile}
              />
              <MessageInput groupId={groupView.id} onSent={handleSent} isMobile={isMobile} />
            </>
          )}

          {/* Tab content - only when no chat is active and not in admin mode */}
          {!showChat && !showAdmin && (
            <>
              {/* Mobile header with menu */}
              {isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, position: 'relative' }}>
                  <span style={{ fontSize: '17px', fontWeight: '700', color: '#111b21', letterSpacing: '-0.3px' }}>Ephemera</span>
                  <button
                    onClick={() => setShowMobileMenu(v => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#667781', fontSize: '20px' }}
                  >
                    ⋮
                  </button>
                  {showMobileMenu && (
                    <>
                      <div onClick={() => setShowMobileMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                      <div style={{
                        position: 'absolute', top: '44px', right: '12px',
                        background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                        padding: '6px', zIndex: 100, minWidth: '180px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                      }}>
                        <button
                          onClick={() => { setShowMobileMenu(false); setShowSettings(true) }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#111b21', fontSize: '14px', fontFamily: "'Outfit', sans-serif", textAlign: 'left' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f2f5')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          ⚙️ Configuración
                        </button>
                        <button
                          onClick={() => { setShowMobileMenu(false); setActiveTab('permissions') }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#f59e0b', fontSize: '14px', fontFamily: "'Outfit', sans-serif", textAlign: 'left' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,158,11,0.06)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          🔐 Permisos
                        </button>
                        {updateInfo && (
                          <button
                            onClick={() => { setShowMobileMenu(false); if (updateInfo.downloadUrl) window.open(updateInfo.downloadUrl, '_blank') }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(0,136,204,0.2)', borderRadius: '8px', cursor: 'pointer', color: '#0088cc', fontSize: '13px', fontWeight: '600', fontFamily: "'Outfit', sans-serif", textAlign: 'left' }}
                          >
                            ⬆️ Actualizar v{updateInfo.version}
                          </button>
                        )}
                        <button
                          onClick={() => { setShowMobileMenu(false); if (user) { import('../lib/push').then(m => m.unsubscribePush(user.id)); logout() } }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#ea4335', fontSize: '14px', fontFamily: "'Outfit', sans-serif", textAlign: 'left' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(234,67,53,0.06)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          🚪 Cerrar sesión
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'chats' && (
                <DmList
                  activeDmId={dmView?.conversationId ?? null}
                  onSelectDm={handleSelectDm}
                />
              )}
              {activeTab === 'groups' && (
                <GroupList
                  activeGroupId={groupView?.id ?? null}
                  onSelectGroup={handleSelectGroup}
                  onAdminPanel={() => setShowAdmin(true)}
                />
              )}
              {activeTab === 'stories' && (
                <StoriesTab
                  key={storiesRefreshKey}
                  onViewStory={(story, allSorted) => { setStoryViewerStory(story); setViewerStories(allSorted); setStoryViewerIndex(allSorted.findIndex(s => s.id === story.id)) }}
              onStoryViewed={loadStoryCount}
              onCreateStory={() => setShowStoryCreator(true)}
            />
          )}
          {activeTab === 'calls' && (
            <CallsTab onCallGroup={(id, name) => { handleSelectGroup(id, name); setActiveTab('groups') }} />
          )}
          {activeTab === 'contacts' && (
            <ContactsTab
              onMessage={handleMessageContact}
              onCall={(otherId, otherAlias) => startCall(crypto.randomUUID(), [{ userId: otherId, alias: otherAlias }])}
            />
          )}
          {activeTab === 'permissions' && (
            <PermissionsRequest onClose={() => setActiveTab('chats')} />
          )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Navigation - only on mobile, hidden inside chat or admin */}
      {isMobile && !showChat && !showAdmin && (
        <BottomNav
          active={activeTab}
          onTabChange={handleTabChange}
          unreadChats={unreadChats}
          unreadGroups={unreadGroups}
          storyCount={storyCount}
          missedCalls={0}
        />
      )}

      {/* Admin Panel - full page */}
      {showAdmin && (
        <AdminPanel initialTab="approvals" onClose={() => setShowAdmin(false)} />
      )}

      {/* Phone popup for users without a registered number */}
      {showPhonePopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px 24px', width: '340px', maxWidth: '92%', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', fontFamily: "'Outfit', sans-serif" }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '56px', height: '56px', margin: '0 auto 12px', background: 'linear-gradient(135deg, #00a884, #0088cc)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: '#fff', boxShadow: '0 8px 24px rgba(0,168,132,0.3)' }}>
                🇵🇪
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111b21', margin: '0 0 6px' }}>Registra tu número</h2>
              <p style={{ fontSize: '13px', color: '#8696a0', margin: 0 }}>Tu celular es necesario para utilizar todas las funciones</p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8696a0', marginBottom: '8px', fontWeight: '500' }}>
                CELULAR
              </label>
              <div style={{ display: 'flex', gap: '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0f2f5', border: '1px solid #e5e7eb', borderRight: 'none', borderRadius: '10px 0 0 10px', padding: '0 12px', fontSize: '15px', color: '#111b21', fontFamily: "'Outfit', sans-serif" }}>
                  <span style={{ fontSize: '18px' }}>🇵🇪</span>
                  <span style={{ fontWeight: '500' }}>+51</span>
                </div>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="999 888 777"
                  autoFocus
                  style={{ flex: 1, background: '#f0f2f5', border: '1px solid #e5e7eb', borderRadius: '0 10px 10px 0', padding: '12px 16px', color: '#111b21', fontSize: '15px', fontFamily: "'Outfit', sans-serif", outline: 'none' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setShowPhonePopup(false)}
                style={{ flex: 1, padding: '12px', background: '#f0f2f5', border: '1px solid #e5e7eb', borderRadius: '10px', color: '#667781', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
              >
                Después
              </button>
              <button
                onClick={async () => {
                  if (!user || !phoneInput.trim()) return
                  await supabase.from('users').update({ phone: '+51' + phoneInput.trim() }).eq('id', user.id)
                  const updated = { ...user, phone: '+51' + phoneInput.trim() }
                  setUser(updated)
                  localStorage.setItem('ephemera_session', JSON.stringify(updated))
                  setShowPhonePopup(false)
                  setPhoneInput('')
                }}
                style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #00a884, #0088cc)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlays */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showMembers && groupView && (
        <GroupMembersPanel groupId={groupView.id} onClose={() => setShowMembers(false)} />
      )}
      {showStoryCreator && (
        <StoryCreator onClose={() => setShowStoryCreator(false)} onCreated={() => { loadStoryCount(); setStoriesRefreshKey(k => k + 1) }} />
      )}
      {storyViewerStory && (
        <StoryViewer
          story={storyViewerStory}
          allStories={viewerStories}
          currentIndex={storyViewerIndex}
          onClose={() => setStoryViewerStory(null)}
          onNext={() => { const next = storyViewerIndex + 1; if (next < viewerStories.length) { setStoryViewerIndex(next); setStoryViewerStory(viewerStories[next]) } else { setStoryViewerStory(null) } }}
          onPrev={() => { const prev = storyViewerIndex - 1; if (prev >= 0) { setStoryViewerIndex(prev); setStoryViewerStory(viewerStories[prev]) } }}
          onDelete={() => { setStoryViewerStory(null); setStoriesRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}
