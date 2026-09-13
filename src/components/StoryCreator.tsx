import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Props = {
  onClose: () => void
  onCreated: () => void
}

function captureVideoFrame(video: HTMLVideoElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 320
    canvas.height = video.videoHeight || 240
    const ctx = canvas.getContext('2d')
    if (!ctx) { resolve(null); return }

    function captureAt(time: number) {
      video.currentTime = time
      video.onseeked = () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.6)
        } catch { resolve(null) }
      }
    }

    // Try 0.5s first, fallback to duration/2, then 0
    if (video.duration > 0.5) {
      captureAt(0.5)
    } else if (video.duration > 0) {
      captureAt(video.duration / 2)
    } else {
      captureAt(0)
    }

    // Safety timeout
    setTimeout(() => {
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.6)
      } catch { resolve(null) }
    }, 3000)
  })
}

export default function StoryCreator({ onClose, onCreated }: Props) {
  const { user } = useAuth()
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaFile(file)
    setMediaType(file.type.startsWith('video/') ? 'video' : 'image')
    setPreview(URL.createObjectURL(file))
  }

  async function upload() {
    if (!mediaFile || !user) return
    setUploading(true)

    const ext = mediaFile.name.split('.').pop() ?? 'jpg'
    const path = `stories/${user.id}/${Date.now()}.${ext}`

    const { data: uploadData, error: uploadError } = await supabase.storage.from('media').upload(path, mediaFile, {
      contentType: mediaFile.type,
    })
    if (uploadError) { setUploading(false); return }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
    const mediaUrl = urlData.publicUrl

    // Capture thumbnail for videos
    let thumbnailUrl: string | null = null
    if (mediaType === 'video' && videoRef.current) {
      console.log('[STORY THUMB] capturando frame del video para portada...')
      const blob = await captureVideoFrame(videoRef.current)
      console.log('[STORY THUMB] blob recibido:', blob ? 'SI (' + blob.size + ' bytes)' : 'NO')
      if (blob) {
        const thumbPath = `stories/${user.id}/${Date.now()}_thumb.jpg`
        console.log('[STORY THUMB] subiendo portada a:', thumbPath)
        const { error: thumbErr } = await supabase.storage.from('media').upload(thumbPath, blob, { contentType: 'image/jpeg' })
        if (!thumbErr) {
          const { data: thumbUrl } = supabase.storage.from('media').getPublicUrl(thumbPath)
          thumbnailUrl = thumbUrl.publicUrl
          console.log('[STORY THUMB] portada guardada:', thumbnailUrl)
        } else {
          console.error('[STORY THUMB] error subiendo portada:', thumbErr)
        }
      } else {
        console.log('[STORY THUMB] no se pudo capturar frame del video')
      }
    } else {
      console.log('[STORY THUMB] no aplica: mediaType=', mediaType, 'videoRef=', !!videoRef.current)
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      media_url: mediaUrl,
      media_type: mediaType,
      caption: caption.trim() || null,
      expires_at: expiresAt,
    }
    if (thumbnailUrl) insertPayload.thumbnail_url = thumbnailUrl

    const { error: insertError } = await supabase.from('stories').insert(insertPayload)
    if (insertError) console.error('[STORY] insert error:', insertError)

    setUploading(false)
    onCreated()
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#f0f2f5',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#00a884',
            fontSize: '14px',
            cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          Cancelar
        </button>
        <span style={{ fontSize: '15px', fontWeight: '600', color: '#111b21' }}>Nueva historia</span>
        <button
          onClick={upload}
          disabled={!mediaFile || uploading}
          style={{
            background: mediaFile ? '#00a884' : 'transparent',
            border: 'none',
            color: mediaFile ? '#fff' : '#adb5bd',
            fontSize: '14px',
            fontWeight: '600',
            cursor: mediaFile ? 'pointer' : 'default',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {uploading ? '...' : 'Publicar'}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        {preview ? (
          <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '70%' }}>
            {mediaType === 'video' ? (
              <video
                ref={videoRef}
                src={preview}
                autoPlay
                playsInline
                loop
                style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '12px' }}
              />
            ) : (
              <img
                src={preview}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '12px', objectFit: 'contain' }}
              />
            )}
            <button
              onClick={() => { setMediaFile(null); setPreview(null) }}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'rgba(0,0,0,0.6)',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '12px',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'rgba(0,168,132,0.1)',
              border: '2px dashed #00a884',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: '#00a884',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span style={{ fontSize: '11px', fontWeight: '500' }}>Foto o Video</span>
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} style={{ display: 'none' }} />

        {preview && (
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Agrega un caption..."
            maxLength={200}
            style={{
              marginTop: '16px',
              width: '100%',
              maxWidth: '320px',
              padding: '10px 14px',
              background: '#f0f2f5',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              color: '#111b21',
              fontSize: '13px',
              textAlign: 'center',
              fontFamily: "'Outfit', sans-serif",
            }}
          />
        )}

        <div style={{ marginTop: '16px', fontSize: '11px', color: '#adb5bd', textAlign: 'center' }}>
          La historia expira en 24 horas
        </div>
      </div>
    </div>
  )
}
