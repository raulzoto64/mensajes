import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

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
}

type Props = {
  story: Story
  allStories: Story[]
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrev: () => void
  onDelete?: (storyId: string) => void
}

export default function StoryViewer({ story, allStories, currentIndex, onClose, onNext, onPrev, onDelete }: Props) {
  const { user } = useAuth()
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const canDelete = user && (user.id === story.user_id || user.is_admin || user.is_super_admin)
  console.log('[STORY VIEWER] mostrando historia:', story.id, 'tipo:', story.media_type, 'thumbnail_url:', story.thumbnail_url ? 'SI' : 'NO')

  useEffect(() => {
    setProgress(0)
    if (story.media_type === 'video') return

    const duration = 5000
    const interval = 50
    let elapsed = 0

    timerRef.current = window.setInterval(() => {
      elapsed += interval
      setProgress((elapsed / duration) * 100)
      if (elapsed >= duration) {
        clearInterval(timerRef.current!)
        onNext()
      }
    }, interval)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [story.id, story.media_type])

  function handleVideoEnd() {
    onNext()
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') onNext()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const [startY, setStartY] = useState<number | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    setStartY(e.touches[0].clientY)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (startY === null) return
    const endY = e.changedTouches[0].clientY
    const diff = startY - endY
    if (Math.abs(diff) > 50) {
      if (diff > 0) onNext()
      else onPrev()
    }
    setStartY(null)
  }

  const [msgText, setMsgText] = useState('')

  async function sendStoryMessage(type: string, content: string | null, mediaUrl: string | null) {
    if (!user || !story) return
    // Guardar mensaje de historia (persistencia simple)
    await supabase.from('story_messages').insert({ story_id: story.id, user_id: user.id, type, content, media_url: mediaUrl, created_at: new Date().toISOString() })

    // Generar mensaje en chat con quoted_story
    const chatPayload = {
      conversation_id: `story-${story.id}-${user.id}`,
      sender_id: user.id,
      type: type === 'emoji' ? 'emoji' : 'text',
      content: content || '',
      media_url: mediaUrl,
      is_deleted: false,
      one_time_view: false,
      quoted_story: {
        story_id: story.id,
        media_url: story.media_url,
        caption: story.caption,
        user_alias: story.user_alias,
      }
    }
    await supabase.from('direct_messages').insert(chatPayload)

    setMsgText('')
    // Cerrar historia y redirigir al chat (simulado con callback si existe)
    onClose()
  }

  const timeLeft = () => {
    const diff = new Date(story.expires_at).getTime() - Date.now()
    const hours = Math.floor(diff / 3600000)
    if (hours > 0) return `${hours}h`
    const mins = Math.floor((diff % 3600000) / 60000)
    return `${mins}m`
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#fff',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'pan-y',
        paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar */}
      <div style={{ position: 'absolute', top: '0', left: '0', right: '0', padding: '8px 12px', zIndex: 10, display: 'flex', gap: '3px' }}>
        {allStories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: '2px', background: 'rgba(255,255,255,0.3)', borderRadius: '1px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: '#fff',
                borderRadius: '1px',
                width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
                transition: i === currentIndex ? 'width 50ms linear' : 'none',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '0',
          right: '0',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 10,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00a884, #0088cc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '700',
            color: '#fff',
          }}
        >
          {story.user_alias[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>@{story.user_alias}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Expira en {timeLeft()}</div>
        </div>
        {canDelete && (
          <button
            onClick={() => { if (onDelete) onDelete(story.id); onClose() }}
            style={{
              background: 'rgba(239,68,68,0.3)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '14px',
            }}
          >
            🗑️
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
            fontSize: '16px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Media */}
      <div style={{ maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {story.media_type === 'video' ? (
          <video
            ref={videoRef}
            src={story.media_url}
            autoPlay
            playsInline
            onEnded={handleVideoEnd}
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px' }}
          />
        ) : (
          <img
            src={story.media_url}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }}
          />
        )}
      </div>

      {/* Caption */}
      {story.caption && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '16px',
            right: '16px',
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '13px',
            textAlign: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          {story.caption}
        </div>
      )}

      {/* Story message input */}
      <div style={{ position: 'absolute', bottom: '24px', left: '12px', right: '12px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fff', borderRadius: '24px', border: '1px solid #E9ECEF', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
        <input
          value={msgText}
          onChange={e => setMsgText(e.target.value)}
          placeholder="Responder historia..."
          onKeyDown={e => { if (e.key === 'Enter' && msgText.trim()) { sendStoryMessage('text', msgText.trim(), null); } }}
          style={{ flex: 1, background: '#F0F2F5', border: '1px solid #E9ECEF', borderRadius: '12px', color: '#111B21', fontSize: '13px', fontFamily: "'Outfit', sans-serif", outline: 'none', padding: '6px 10px' }}
        />
        <button onClick={() => { if (msgText.trim()) sendStoryMessage('emoji', msgText.trim(), null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '18px', padding: '4px' }}>😀</button>
        <button onClick={() => sendStoryMessage('text', msgText.trim() || '👍', null)} style={{ background: '#008069', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>➤</button>
      </div>

      {/* Touch zones */}
      <button
        onClick={onPrev}
        style={{ position: 'absolute', left: '0', top: '0', bottom: '0', width: '30%', background: 'transparent', border: 'none', cursor: 'pointer' }}
      />
      <button
        onClick={onNext}
        style={{ position: 'absolute', right: '0', top: '0', bottom: '0', width: '30%', background: 'transparent', border: 'none', cursor: 'pointer' }}
      />
    </div>
  )
}
