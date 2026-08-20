import { useEffect, useState } from 'react'

export type LightboxMedia = {
  type: 'image' | 'gif' | 'video'
  url: string
  sender_alias: string
}

const mq = () => window.matchMedia('(max-width: 767px)')

export default function MediaLightbox({ media, onClose }: { media: LightboxMedia | null; onClose: () => void }) {
  const [isMobile, setIsMobile] = useState(() => mq().matches)

  useEffect(() => {
    const m = mq()
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    m.addEventListener('change', handler)
    return () => m.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!media) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [media, onClose])

  if (!media) return null

  const dim = isMobile
    ? { width: '100vw', height: '100dvh', maxWidth: '100vw', maxHeight: '100dvh' }
    : { width: 'auto', height: 'auto', maxWidth: 'min(90vw, 900px)', maxHeight: 'min(88vh, 700px)' }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'rgba(0,0,0,0.94)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'zoom-out',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '100vw', maxHeight: '100dvh' }}>
        {media.type === 'video' ? (
          <video
            src={media.url}
            controls
            autoPlay
            playsInline
            style={{ display: 'block', objectFit: 'contain', background: '#000', cursor: 'default', ...dim }}
          />
        ) : (
          <img
            src={media.url}
            alt="Medio"
            style={{ display: 'block', objectFit: 'contain', cursor: 'zoom-out', ...dim }}
          />
        )}
        <div
          style={{
            textAlign: 'center',
            padding: '12px',
            color: '#9ca3af',
            fontSize: '13px',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          @{media.sender_alias}
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: '14px',
          right: '14px',
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff',
          fontSize: '16px',
          cursor: 'pointer',
          zIndex: 401,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  )
}