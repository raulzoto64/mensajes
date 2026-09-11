import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Story = {
  id: string
  user_id: string
  user_alias: string
  media_url: string
  media_type: 'image' | 'video'
  caption: string | null
  created_at: string
  expires_at: string
  viewed: boolean
}

type Props = {
  onViewStory: (story: Story) => void
  onCreateStory: () => void
}

export default function StoriesTab({ onViewStory, onCreateStory }: Props) {
  const { user } = useAuth()
  const [stories, setStories] = useState<Story[]>([])
  const [myStories, setMyStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)

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
    setLoading(true)
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('stories')
      .select('*, users!stories_user_id_fkey(alias)')
      .gt('expires_at', now)
      .order('created_at', { ascending: false })

    if (data) {
      const { data: viewed } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('user_id', user.id)

      const viewedIds = new Set((viewed ?? []).map((v: any) => v.story_id))

      const mapped: Story[] = data.map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        user_alias: s.users?.alias ?? 'usuario',
        media_url: s.media_url,
        media_type: s.media_type,
        caption: s.caption,
        created_at: s.created_at,
        expires_at: s.expires_at,
        viewed: viewedIds.has(s.id),
      }))

      setMyStories(mapped.filter((s) => s.user_id === user.id))
      setStories(mapped.filter((s) => s.user_id !== user.id))
    }
    setLoading(false)
  }

  async function markViewed(storyId: string) {
    if (!user) return
    await supabase.from('story_views').upsert({ story_id: storyId, user_id: user.id })
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  function timeUntilExpiry(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now()
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    return `${hours}h ${mins}m`
  }

  const unviewedStories = stories.filter((s) => !s.viewed)
  const viewedStories = stories.filter((s) => s.viewed)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      {/* My Story */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            background: '#14142a',
            borderRadius: '12px',
            border: '1px solid #1e1e3a',
          }}
        >
          <div
            onClick={onCreateStory}
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'rgba(139,92,246,0.15)',
              border: '2px dashed #8b5cf6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '22px',
              color: '#8b5cf6',
              flexShrink: 0,
            }}
          >
            +
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#e8e8f0' }}>
              Mi historia
            </div>
            <div style={{ fontSize: '12px', color: '#6b6b8a' }}>
              {myStories.length > 0
                ? `${myStories.length} historia${myStories.length > 1 ? 's' : ''} · Expira en ${timeUntilExpiry(myStories[0].expires_at)}`
                : 'Toca para crear una historia'}
            </div>
          </div>
          {myStories.length > 0 && (
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '2px solid #8b5cf6',
              }}
            >
              <img
                src={myStories[0].media_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Unviewed stories */}
      {unviewedStories.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', padding: '0 4px 8px' }}>
            SIN VER
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {unviewedStories.map((story) => (
              <div
                key={story.id}
                onClick={() => { markViewed(story.id); onViewStory(story) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  background: '#14142a',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  border: '1px solid transparent',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6, #22d3ee)',
                    padding: '2px',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: '#0a0a18',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '15px',
                      fontWeight: '700',
                      color: '#c4b5fd',
                    }}
                  >
                    {story.user_alias[0]?.toUpperCase()}
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#e8e8f0' }}>
                    @{story.user_alias}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b6b8a' }}>
                    {timeAgo(story.created_at)} · {story.media_type === 'video' ? 'Video' : 'Foto'}
                  </div>
                </div>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={story.media_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Viewed stories */}
      {viewedStories.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', padding: '0 4px 8px' }}>
            VISTAS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {viewedStories.map((story) => (
              <div
                key={story.id}
                onClick={() => onViewStory(story)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  background: '#14142a',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  opacity: 0.7,
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: '2px solid #3d3d5c',
                    padding: '2px',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: '#14142a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '15px',
                      fontWeight: '700',
                      color: '#6b6b8a',
                    }}
                  >
                    {story.user_alias[0]?.toUpperCase()}
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '13px', color: '#6b6b8a' }}>
                    @{story.user_alias}
                  </div>
                  <div style={{ fontSize: '11px', color: '#3d3d5c' }}>
                    {timeAgo(story.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && stories.length === 0 && myStories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3d3d5c' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📖</div>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: '#6b6b8a' }}>
            No hay historias
          </div>
          <div style={{ fontSize: '12px' }}>
            Crea tu primera historia para compartirla
          </div>
        </div>
      )}
    </div>
  )
}
