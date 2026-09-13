import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Props = {
  onClose: () => void
  onCreated: () => void
}

export default function StoryCreator({ onClose, onCreated }: Props) {
  const { user } = useAuth()
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
    const { error: uploadError } = await supabase.storage.from('media').upload(path, mediaFile, {
      contentType: mediaFile.type,
    })
    if (uploadError) { setUploading(false); return }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('stories').insert({
      user_id: user.id,
      media_url: urlData.publicUrl,
      media_type: mediaType,
      caption: caption.trim() || null,
      expires_at: expiresAt,
    })

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
