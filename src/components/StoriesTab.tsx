import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Story = {
  id: string
  user_id: string
  user_alias: string
  media_url: string
  media_type: 'image' | 'video'
  thumbnail_url: string | null
  caption: string | null
  created_at: string
  expires_at: string
  viewed: boolean
}

type Props = {
  onViewStory: (story: Story, allSorted: Story[]) => void
  onStoryViewed: () => void
  onCreateStory: () => void
}

export default function StoriesTab({ onViewStory, onStoryViewed, onCreateStory }: Props) {
  const { user } = useAuth()
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<Story | null>(null)
  const deletedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    loadStories()
    const channel = supabase
      .channel('stories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, loadStories)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function loadStories() {
    if (!user) return

    const CACHE_KEY = 'ephemera_cache_stories'
    const CACHE_TTL = 60 * 60 * 1000
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < CACHE_TTL) {
        setStories(data)
        setLoading(false)
      }
    }

    setLoading(true)
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('stories')
      .select('*, users!stories_user_id_fkey(alias)')
      .gt('expires_at', now)
      .order('created_at', { ascending: false })

    if (error) { console.error('[STORIES] load error:', error); setLoading(false); return }

    if (data) {
      const { data: viewed } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('user_id', user.id)

      const viewedIds = new Set((viewed ?? []).map((v: any) => v.story_id))

      const mapped: Story[] = data
        .filter((s: any) => !deletedIdsRef.current.has(s.id))
        .map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        user_alias: s.users?.alias ?? 'usuario',
        media_url: s.media_url,
        media_type: s.media_type,
        thumbnail_url: s.thumbnail_url ?? null,
        caption: s.caption,
        created_at: s.created_at,
        expires_at: s.expires_at,
        viewed: viewedIds.has(s.id),
      }))

      setStories(mapped)
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: mapped, timestamp: Date.now() }))
    }
    setLoading(false)
  }

  async function markViewed(storyId: string) {
    if (!user) return
    await supabase.from('story_views').upsert({ story_id: storyId, user_id: user.id }, { onConflict: 'story_id,user_id' })
  }

  async function deleteStory(storyId: string) {
    await supabase.from('stories').delete().eq('id', storyId)
    setStories(prev => prev.filter(s => s.id !== storyId))
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  const myStories = stories.filter((s) => s.user_id === user?.id)
  const otherStories = stories.filter((s) => s.user_id !== user?.id)

  // Group other stories by user
  const groupedByUser = otherStories.reduce<Record<string, Story[]>>((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = []
    acc[s.user_id].push(s)
    return acc
  }, {})

  // Sort: unviewed first, then viewed (for viewer)
  const sortedForViewer = [...stories].sort((a, b) => {
    if (a.viewed === b.viewed) return 0
    return a.viewed ? 1 : -1
  })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      {/* Story bubbles row */}
      <div style={{
        display: 'flex', gap: '12px', padding: '8px 0 16px',
        overflowX: 'auto', overflowY: 'hidden',
      }}>
        {/* My story bubble */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            {/* Profile circle */}
            <div
              onClick={myStories.length > 0 ? () => { myStories.forEach(s => markViewed(s.id)); onViewStory(myStories[0]) } : onCreateStory}
              style={{
                width: '60px', height: '60px', borderRadius: '50%',
                background: myStories.length > 0 ? 'linear-gradient(135deg, #00a884, #0088cc)' : '#f0f2f5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                border: myStories.length > 0 ? '3px solid #00a884' : '3px dashed #00a884',
              }}
            >
              {myStories.length > 0 ? (
                <img src={myStories[0].media_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '24px', color: '#00a884' }}>👤</span>
              )}
            </div>
            {/* Plus badge - clickable to create new */}
            <div
              onClick={(e) => { e.stopPropagation(); onCreateStory() }}
              style={{
                position: 'absolute', bottom: '-2px', right: '-2px',
                width: '22px', height: '22px', borderRadius: '50%',
                background: myStories.length > 0 ? '#00a884' : '#ffffff',
                border: myStories.length > 0 ? '2px solid #fff' : '2px solid #00a884',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '14px', fontWeight: '700',
                color: myStories.length > 0 ? '#fff' : '#00a884',
                lineHeight: 1,
              }}
            >+</div>
          </div>
          <span style={{ fontSize: '10px', color: '#8696a0', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Tu</span>
        </div>

        {/* Other users' story bubbles */}
        {Object.entries(groupedByUser).map(([userId, userStories]) => {
          const allViewed = userStories.every(s => s.viewed)
          return (
            <div key={userId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <div
                onClick={() => { userStories.forEach(s => markViewed(s.id)); onViewStory(userStories[0]) }}
                style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: allViewed ? '#f0f2f5' : 'linear-gradient(135deg, #00a884, #0088cc)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  border: allViewed ? '3px solid #adb5bd' : '3px solid #00a884',
                }}
              >
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: '700',
                  color: allViewed ? '#8696a0' : '#00a884',
                }}>
                  {userStories[0].user_alias[0]?.toUpperCase()}
                </div>
              </div>
              <span style={{ fontSize: '10px', color: '#8696a0', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{userStories[0].user_alias}
              </span>
            </div>
          )
        })}
      </div>

      {/* Reels grid */}
      {!loading && stories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#adb5bd' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📖</div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#8696a0', marginBottom: '4px' }}>No hay historias</div>
          <div style={{ fontSize: '12px' }}>Crea tu primera historia</div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '10px',
      }}>
        {stories.map((story) => {
          const canDelete = user && (story.user_id === user.id || user.is_admin || user.is_super_admin)
          return (
            <ReelCard key={story.id} story={story} isMine={story.user_id === user?.id} canDelete={!!canDelete} timeAgo={timeAgo} onClick={() => { markViewed(story.id); onViewStory(story, sortedForViewer) }} onDelete={() => setConfirmDelete(story)} />
          )
        })}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '16px', padding: '28px 24px', width: '320px', maxWidth: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', fontFamily: "'Outfit', sans-serif" }}
          >
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '36px' }}>🗑️</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#111b21', marginBottom: '8px', textAlign: 'center' }}>Eliminar historia</div>
            <p style={{ fontSize: '14px', color: '#667781', margin: '0 0 20px', textAlign: 'center', lineHeight: '1.5' }}>
              ¿Estás seguro de que quieres eliminar esta historia de <strong>@{confirmDelete.user_alias}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: '11px', background: '#f0f2f5', border: '1px solid #e5e7eb', borderRadius: '10px', color: '#667781', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { deleteStory(confirmDelete.id); setConfirmDelete(null) }}
                style={{ flex: 1, padding: '11px', background: '#ea4335', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReelCard({ story, isMine, canDelete, timeAgo, onClick, onDelete }: { story: Story; isMine: boolean; canDelete: boolean; timeAgo: (d: string) => string; onClick: () => void; onDelete: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        aspectRatio: '9/16',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        border: isMine ? '2px solid #00a884' : story.viewed ? '2px solid #adb5bd' : '2px solid transparent',
        transition: 'transform 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {story.media_type === 'video' ? (
        <video src={story.thumbnail_url || story.media_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <img src={story.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
      }} />

      <div style={{
        position: 'absolute', bottom: '8px', left: '8px', right: '8px',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: isMine ? '#00a884' : 'linear-gradient(135deg, #00a884, #0088cc)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: '700', color: '#fff', flexShrink: 0,
          border: '2px solid rgba(255,255,255,0.8)',
        }}>
          {story.user_alias[0]?.toUpperCase()}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isMine ? 'Tú' : `@${story.user_alias}`}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>
            {timeAgo(story.created_at)} · {story.media_type === 'video' ? '📹' : '📷'}
          </div>
        </div>
      </div>

      {story.viewed && !isMine && (
        <div style={{
          position: 'absolute', top: '6px', right: '6px',
          background: 'rgba(0,0,0,0.5)', borderRadius: '6px',
          padding: '2px 6px', fontSize: '9px', color: '#adb5bd',
        }}>Visto</div>
      )}

      {isMine && (
        <div style={{
          position: 'absolute', top: '6px', right: '6px',
          background: 'rgba(0,168,132,0.8)', borderRadius: '6px',
          padding: '2px 6px', fontSize: '9px', color: '#fff',
        }}>Mi historia</div>
      )}

      {canDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{
            position: 'absolute', top: '6px', left: '6px',
            background: 'rgba(239,68,68,0.8)', borderRadius: '50%',
            width: '24px', height: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer', fontSize: '11px', color: '#fff',
            zIndex: 2,
          }}
        >
          🗑️
        </button>
      )}

      {story.caption && (
        <div style={{
          position: 'absolute', bottom: '40px', left: '8px', right: '8px',
          fontSize: '10px', color: 'rgba(255,255,255,0.9)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}>
          {story.caption}
        </div>
      )}
    </div>
  )
}
