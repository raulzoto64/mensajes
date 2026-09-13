import { useState, useEffect } from 'react'
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

      setStories(mapped)
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

  const myStories = stories.filter((s) => s.user_id === user?.id)
  const otherStories = stories.filter((s) => s.user_id !== user?.id)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      {/* Create story button */}
      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={onCreateStory}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'rgba(0,168,132,0.12)', border: '2px dashed #00a884',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', color: '#00a884', flexShrink: 0,
          }}>+</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#111b21' }}>Nueva historia</div>
            <div style={{ fontSize: '12px', color: '#8696a0' }}>
              {myStories.length > 0 ? `${myStories.length} publicada${myStories.length > 1 ? 's' : ''}` : 'Comparte algo'}
            </div>
          </div>
        </button>
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '10px',
      }}>
        {/* My stories first */}
        {myStories.map((story) => (
          <ReelCard key={story.id} story={story} isMine timeAgo={timeAgo} onClick={() => { markViewed(story.id); onViewStory(story) }} />
        ))}
        {/* Other stories */}
        {otherStories.map((story) => (
          <ReelCard key={story.id} story={story} isMine={false} timeAgo={timeAgo} onClick={() => { markViewed(story.id); onViewStory(story) }} />
        ))}
      </div>
    </div>
  )
}

function ReelCard({ story, isMine, timeAgo, onClick }: { story: Story; isMine: boolean; timeAgo: (d: string) => string; onClick: () => void }) {
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
      {/* Media */}
      {story.media_type === 'video' ? (
        <video src={story.media_url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <img src={story.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '50%',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
      }} />

      {/* User info */}
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

      {/* Viewed badge */}
      {story.viewed && !isMine && (
        <div style={{
          position: 'absolute', top: '6px', right: '6px',
          background: 'rgba(0,0,0,0.5)', borderRadius: '6px',
          padding: '2px 6px', fontSize: '9px', color: '#adb5bd',
        }}>Visto</div>
      )}

      {/* My badge */}
      {isMine && (
        <div style={{
          position: 'absolute', top: '6px', right: '6px',
          background: 'rgba(0,168,132,0.8)', borderRadius: '6px',
          padding: '2px 6px', fontSize: '9px', color: '#fff',
        }}>Mi historia</div>
      )}

      {/* Caption */}
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
