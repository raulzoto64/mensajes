import { useState, useEffect, useRef } from 'react'

type Story = {
  id: string
  user_id: string
  user_alias: string
  media_url: string
  media_type: 'image' | 'video'
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
}

export default function StoryViewer({ story, allStories, currentIndex, onClose, onNext, onPrev }: Props) {
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

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
        background: '#000',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
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
            background: 'linear-gradient(135deg, #8b5cf6, #22d3ee)',
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
