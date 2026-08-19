import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import EmojiPicker from './EmojiPicker'
import GifPicker from './GifPicker'
import { notifyChatChanged, notifyTyping, addPendingMessage, removePendingMessage } from '../lib/realtime'

type Props = {
  groupId?: string
  conversationId?: string
  onSent: () => void
  isMobile?: boolean
}

type PickerMode = 'none' | 'emoji' | 'gif'
type RecordMode = 'none' | 'audio' | 'video'

export default function MessageInput({ groupId, conversationId, onSent, isMobile }: Props) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [picker, setPicker] = useState<PickerMode>('none')
  const [recordMode, setRecordMode] = useState<RecordMode>('none')
  const [recording, setRecording] = useState(false)
  const [recordTime, setRecordTime] = useState(0)
  const [sending, setSending] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [mediaOpen, setMediaOpen] = useState(false)
  const mediaRef = useRef<HTMLDivElement>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoFileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastTypingSent = useRef(0)

  const typingScope = conversationId ? `dm-${conversationId}` : groupId ? `group-${groupId}` : ''

  function genTempId() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  function broadcastTyping() {
    if (!typingScope || !user) return
    const now = Date.now()
    if (now - lastTypingSent.current < 800) return
    lastTypingSent.current = now
    notifyTyping(typingScope, user.id, user.alias)
  }

  useEffect(() => {
    if (!typingScope || !user || !text.trim()) return
    const id = setInterval(broadcastTyping, 1500)
    return () => clearInterval(id)
  }, [typingScope, user, text])

  async function sendMessage(type: string, content: string | null, mediaUrl: string | null, tempId?: string) {
    if (!user) return
    const scope = groupId ? `group-${groupId}` : conversationId ? `dm-${conversationId}` : ''
    setSending(true)
    if (conversationId) {
      const { data: inserted, error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          type,
          content,
          media_url: mediaUrl,
          is_deleted: false,
        })
        .select('id')
        .single()
      console.log(`[msg:dm→] insert ${JSON.stringify({ type, content, mediaUrl, inserted, error })}`)
      if (inserted?.id) {
        const { error: viewErr } = await supabase
          .from('direct_message_views')
          .upsert({ message_id: inserted.id, user_id: user.id }, { onConflict: 'message_id,user_id' })
        console.log(`[msg:dm·] vista emisor ${JSON.stringify({ message_id: inserted.id, viewErr })}`)
      }
    } else if (groupId) {
      const { data: inserted, error } = await supabase
        .from('messages')
        .insert({
          group_id: groupId,
          sender_id: user.id,
          type,
          content,
          media_url: mediaUrl,
          is_deleted: false,
        })
        .select('id')
        .single()
      console.log(`[msg:group→] insert ${JSON.stringify({ type, content, mediaUrl, inserted, error })}`)
      if (inserted?.id) {
        const { error: viewErr } = await supabase
          .from('message_views')
          .upsert({ message_id: inserted.id, user_id: user.id }, { onConflict: 'message_id,user_id' })
        console.log(`[msg:group·] vista emisor ${JSON.stringify({ message_id: inserted.id, viewErr })}`)
      }
    }
    setSending(false)
    if (tempId && scope) removePendingMessage(scope, tempId)
    notifyChatChanged()
    onSent()
  }

  async function handleSendText() {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    resizeTextarea()
    await sendMessage('text', trimmed, null)
  }

  function handleEmojiSelect(emoji: string) {
    // If only emojis are typed or nothing, send as standalone emoji message
    // Otherwise append to text
    if (!text.trim()) {
      sendMessage('emoji', emoji, null)
    } else {
      setText((t) => t + emoji)
      textareaRef.current?.focus()
    }
  }

  function handleSendEmojiStandalone(emoji: string) {
    sendMessage('emoji', emoji, null)
    setPicker('none')
  }

  async function uploadMedia(blob: Blob, type: 'audio' | 'video'): Promise<string | null> {
    if (!user) return null
    const path = `${type}/${user.id}/${Date.now()}.webm`
    console.log(`[upload→] subiendo ${type} path=${path} bytes=${blob.size} mime=${blob.type || 'video/webm'}`)
    const { data, error } = await supabase.storage.from('media').upload(path, blob, { contentType: blob.type || 'video/webm' })
    console.log(`[upload←] ${type} ${JSON.stringify({ data, error })}`)
    if (error) {
      console.error('Upload error:', error)
      setUploadError('No se pudo subir el archivo. Revisa que el bucket "media" exista en Supabase Storage.')
      return null
    }
    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
    console.log(`[upload·] url pública ${JSON.stringify(urlData)}`)
    return urlData.publicUrl
  }

  async function handleMediaFile(e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'video') {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user || sending) return
    const scope = groupId ? `group-${groupId}` : conversationId ? `dm-${conversationId}` : ''
    const preview = URL.createObjectURL(file)
    const tempId = genTempId()
    if (scope) {
      addPendingMessage(scope, { tempId, type: kind, content: null, mediaUrl: preview, createdAt: new Date().toISOString() })
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase() || (kind === 'video' ? 'mp4' : 'jpg')
    const path = `${kind}/${user.id}/${Date.now()}.${ext}`
    console.log(`[upload→] subiendo ${kind}`, { name: file.name, size: file.size, mime: file.type, path })
    setSending(true)
    setUploadError('')
    const { data, error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type })
    console.log(`[upload←] ${kind}`, { data, error })
    if (error) {
      console.error('Upload error:', error)
      setUploadError('No se pudo subir el archivo. Revisa que el bucket "media" exista en Supabase Storage.')
      setSending(false)
      if (scope) removePendingMessage(scope, tempId)
      return
    }
    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
    console.log(`[upload·] url pública ${JSON.stringify(urlData)}`)
    await sendMessage(kind, null, urlData.publicUrl, tempId)
  }

  const startRecording = useCallback(async (type: 'audio' | 'video') => {
    try {
      const constraints = type === 'audio' ? { audio: true } : { audio: true, video: { facingMode: 'user' } }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (type === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream
        videoPreviewRef.current.muted = true
        void videoPreviewRef.current.play()
      }

      const mimeType = type === 'audio' ? 'audio/webm' : 'video/webm'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const preview = URL.createObjectURL(blob)
        const tempId = genTempId()
        const scope = groupId ? `group-${groupId}` : conversationId ? `dm-${conversationId}` : ''
        if (scope) {
          addPendingMessage(scope, { tempId, type, content: null, mediaUrl: preview, createdAt: new Date().toISOString() })
        }
        const url = await uploadMedia(blob, type)
        if (url) await sendMessage(type, null, url, tempId)
        else if (scope) removePendingMessage(scope, tempId)
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null
        setRecordMode('none')
        setRecording(false)
        setRecordTime(0)
        if (timerRef.current) clearInterval(timerRef.current)
      }

      mr.start(250)
      setRecording(true)
      setRecordTime(0)
      timerRef.current = setInterval(() => setRecordTime((t) => t + 1), 1000)
    } catch (err) {
      console.error('Recording error:', err)
      setRecordMode('none')
    }
  }, [groupId, conversationId, user])

  function stopRecording() {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function cancelRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null
    if (timerRef.current) clearInterval(timerRef.current)
    setRecordMode('none')
    setRecording(false)
    setRecordTime(0)
  }

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  function resizeTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 100) + 'px'
  }

  const isRecording = recordMode !== 'none'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicker('none')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        padding: '10px 12px',
        borderTop: '1px solid #1e1e3a',
        background: '#0a0a18',
        flexShrink: 0,
      }}
    >
      {/* Click-outside overlay to close pickers */}
      {(picker === 'emoji' || picker === 'gif') && (
        <div
          onClick={() => setPicker('none')}
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
        />
      )}
      {/* Hidden file inputs for camera/gallery image & video */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleMediaFile(e, 'image')}
      />
      <input
        ref={videoFileInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => handleMediaFile(e, 'video')}
      />
      {/* Emoji picker */}
      {picker === 'emoji' && (
        <EmojiPicker
          onInsert={handleEmojiSelect}
          onSend={handleSendEmojiStandalone}
          onClose={() => setPicker('none')}
          hasText={text.trim().length > 0}
        />
      )}

      {/* GIF picker */}
      {picker === 'gif' && (
        <GifPicker
          onSelect={(url) => {
            const scope = groupId ? `group-${groupId}` : conversationId ? `dm-${conversationId}` : ''
            const tempId = genTempId()
            if (scope) {
              addPendingMessage(scope, { tempId, type: 'gif', content: null, mediaUrl: url, createdAt: new Date().toISOString() })
            }
            sendMessage('gif', null, url, tempId)
            setPicker('none')
          }}
          onClose={() => setPicker('none')}
        />
      )}

      {/* Video preview */}
      {recordMode === 'video' && recording && (
        <div style={{ marginBottom: '8px', borderRadius: '10px', overflow: 'hidden', maxHeight: '140px', background: '#000', border: '1px solid #1e1e3a' }}>
          <video ref={videoPreviewRef} style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', display: 'block' }} muted playsInline />
        </div>
      )}

      {/* Recording UI */}
      {isRecording && recording && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 12px',
            background: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.18)',
            borderRadius: '10px',
            marginBottom: '8px',
          }}
        >
          <span
            className="record-dot"
            style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }}
          />
          <span style={{ color: '#f87171', fontSize: '12px', fontFamily: "'DM Mono', monospace", flex: 1 }}>
            {recordMode === 'audio' ? 'AUDIO' : 'VIDEO'} · {formatTime(recordTime)}
          </span>
          <button
            onClick={stopRecording}
            style={{ background: '#ef4444', border: 'none', borderRadius: '7px', padding: '5px 12px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
          >
            Enviar
          </button>
          <button
            onClick={cancelRecording}
            style={{ background: 'transparent', border: '1px solid #2a2a50', borderRadius: '7px', padding: '5px 10px', color: '#6b6b8a', fontSize: '12px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif' " }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Start recording prompt */}
      {isRecording && !recording && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <button
            onClick={() => startRecording(recordMode)}
            style={{
              flex: 1, padding: '9px',
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: '10px',
              color: '#c4b5fd', fontSize: '13px',
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            {recordMode === 'audio' ? '🎤 Iniciar grabación de audio' : '🎥 Iniciar grabación de video'}
          </button>
          <button
            onClick={() => setRecordMode('none')}
            style={{ padding: '9px 12px', background: '#14142a', border: '1px solid #1e1e3a', borderRadius: '10px', color: '#6b6b8a', fontSize: '13px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload error banner */}
      {uploadError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            marginBottom: '8px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '10px',
          }}
        >
          <span style={{ flex: 1, fontSize: '12px', color: '#f87171', fontFamily: "'Outfit', sans-serif" }}>
            {uploadError}
          </span>
          <button
            onClick={() => setUploadError('')}
            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '14px', padding: '2px 4px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main input row */}
      {!isRecording && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
          {/* Left buttons */}
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <IconBtn active={picker === 'emoji'} onClick={() => setPicker(picker === 'emoji' ? 'none' : 'emoji')} title="Emojis">
              😊
            </IconBtn>
            <IconBtn active={picker === 'gif'} onClick={() => setPicker(picker === 'gif' ? 'none' : 'gif')} title="GIFs" mono>
              GIF
            </IconBtn>
          </div>

          {/* Textarea */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              background: '#14142a',
              border: '1px solid #1e1e3a',
              borderRadius: '12px',
              alignItems: 'flex-end',
              padding: '0 4px 4px 4px',
              minHeight: '42px',
              transition: 'border-color 0.2s',
            }}
            onFocus={() => {}}
          >
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => { setText(e.target.value); resizeTextarea(); broadcastTyping() }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText() }
              }}
              placeholder="Escribe un mensaje..."
              rows={1}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                padding: '10px 10px 0',
                color: '#e8e8f0',
                fontSize: '14px',
                fontFamily: "'Outfit', sans-serif",
                resize: 'none',
                maxHeight: '100px',
                overflowY: 'auto',
                lineHeight: '1.45',
              }}
            />
            <button
              onClick={handleSendText}
              disabled={!text.trim() || sending}
              style={{
                width: '34px',
                height: '34px',
                minWidth: '34px',
                background: text.trim() ? '#8b5cf6' : 'transparent',
                border: 'none',
                borderRadius: '9px',
                color: text.trim() ? '#fff' : '#3d3d5c',
                fontSize: '15px',
                cursor: text.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              ➤
            </button>
          </div>

          {/* Right buttons — en móvil van todos en un desplegable */}
          <div style={{ position: 'relative', display: 'flex', gap: '4px', flexShrink: 0 }} ref={mediaRef}>
            {isMobile ? (
              <>
                <IconBtn active={mediaOpen} onClick={() => setMediaOpen((v) => !v)} title="Enviar multimedia">
                  ➕
                </IconBtn>
                {mediaOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 119 }} onClick={() => setMediaOpen(false)} />
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        bottom: 'calc(100% + 8px)',
                        background: '#0f0f1e',
                        border: '1px solid #1e1e3a',
                        borderRadius: '12px',
                        padding: '6px',
                        zIndex: 120,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <MenuItem onClick={() => { imageInputRef.current?.click(); setMediaOpen(false) }} label="🖼️ Imagen" />
                      <MenuItem onClick={() => { videoFileInputRef.current?.click(); setMediaOpen(false) }} label="🎞️ Video" />
                      <MenuItem onClick={() => { setRecordMode('audio'); setMediaOpen(false) }} label="🎤 Grabar audio" />
                      <MenuItem onClick={() => { setRecordMode('video'); setMediaOpen(false) }} label="📹 Grabar video" />
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <IconBtn active={false} onClick={() => imageInputRef.current?.click()} title="Enviar imagen (cámara o galería)">
                  🖼️
                </IconBtn>
                <IconBtn active={false} onClick={() => videoFileInputRef.current?.click()} title="Enviar video (cámara o galería)">
                  🎞️
                </IconBtn>
                <IconBtn active={false} onClick={() => setRecordMode('audio')} title="Grabar audio">
                  🎤
                </IconBtn>
                <IconBtn active={false} onClick={() => setRecordMode('video')} title="Grabar video">
                  📹
                </IconBtn>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function IconBtn({
  children,
  active,
  onClick,
  title,
  mono,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  title: string
  mono?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: '36px',
        height: '36px',
        background: active ? 'rgba(139,92,246,0.12)' : '#14142a',
        border: `1px solid ${active ? '#8b5cf6' : '#1e1e3a'}`,
        borderRadius: '10px',
        color: active ? '#c4b5fd' : '#6b6b8a',
        fontSize: mono ? '11px' : '15px',
        fontWeight: mono ? '700' : '400',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: mono ? "'DM Mono', monospace" : 'inherit',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function MenuItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: '8px',
        color: '#e8e8f0',
        fontSize: '13px',
        cursor: 'pointer',
        fontFamily: "'Outfit', sans-serif",
        textAlign: 'left',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(34,211,238,0.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
    </button>
  )
}
