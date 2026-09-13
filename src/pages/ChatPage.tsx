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
import DmList from '../components/DmList'
import GroupList from '../components/GroupList'
import { useActivityHeartbeat } from '../lib/realtime'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { clearNotificationsForChat } from '../lib/notifications'

type Tab = 'chats' | 'groups' | 'stories' | 'calls'
type GroupView = { id: string; name: string }
type DmView = { conversationId: string; otherUserId: string; otherAlias: string }

export default function ChatPage() {
  const { user } = useAuth()
  useActivityHeartbeat(user?.id ?? null)
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
  const [showStoryCreator, setShowStoryCreator] = useState(false)
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)
  const [unreadGroups, setUnreadGroups] = useState(0)
  const [storyCount, setStoryCount] = useState(0)

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
    if (!user) return
    const shown = localStorage.getItem('ephemera_permissions_shown')
    if (!shown) {
      setTimeout(() => setShowPermissions(true), 2000)
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
              onSelectGroup={(id, name) => { handleSelectGroup(id, name); setActiveTab('groups') }}
              onSelectDm={handleSelectDm}
              onAdminPanel={() => setShowAdmin(true)}
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
              onSelectGroup={(id, name) => { handleSelectGroup(id, name); setActiveTab('groups') }}
              onSelectDm={handleSelectDm}
              onAdminPanel={() => setShowAdmin(true)}
            />
          </div>
        )}

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, paddingBottom: !showChat && !showAdmin ? '60px' : '0' }}>
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
          {!showChat && !showAdmin && activeTab === 'chats' && (
            <DmList
              activeDmId={dmView?.conversationId ?? null}
              onSelectDm={handleSelectDm}
            />
          )}
          {!showChat && !showAdmin && activeTab === 'groups' && (
            <GroupList
              activeGroupId={groupView?.id ?? null}
              onSelectGroup={handleSelectGroup}
              onAdminPanel={() => setShowAdmin(true)}
            />
          )}
          {!showChat && !showAdmin && activeTab === 'stories' && (
            <StoriesTab
              key={storiesRefreshKey}
              onViewStory={(story) => { setStoryViewerStory(story); setStoryViewerIndex(0) }}
              onStoryViewed={loadStoryCount}
              onCreateStory={() => setShowStoryCreator(true)}
            />
          )}
          {!showChat && !showAdmin && activeTab === 'calls' && (
            <CallsTab onCallGroup={(id, name) => { handleSelectGroup(id, name); setActiveTab('groups') }} />
          )}
        </div>
      </div>

      {/* Bottom Navigation - hidden when inside a chat or admin */}
      {!showChat && !showAdmin && (
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

      {/* Overlays */}
      {showMembers && groupView && (
        <GroupMembersPanel groupId={groupView.id} onClose={() => setShowMembers(false)} />
      )}
      {showPermissions && <PermissionsRequest onClose={() => setShowPermissions(false)} />}
      {showStoryCreator && (
        <StoryCreator onClose={() => setShowStoryCreator(false)} onCreated={() => { loadStoryCount(); setStoriesRefreshKey(k => k + 1) }} />
      )}
      {storyViewerStory && (
        <StoryViewer
          story={storyViewerStory}
          allStories={[]}
          currentIndex={storyViewerIndex}
          onClose={() => setStoryViewerStory(null)}
          onNext={() => setStoryViewerIndex((i) => i + 1)}
          onPrev={() => setStoryViewerIndex((i) => Math.max(i - 1, 0))}
          onDelete={() => { setStoryViewerStory(null); setStoriesRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}
