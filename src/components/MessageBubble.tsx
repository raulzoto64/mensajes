import { useRef, useState } from 'react'
import MediaLightbox, { type LightboxMedia } from './MediaLightbox'

export type Message = {
  id: string
  group_id?: string
  sender_id: string
  sender_alias: string
  type: 'text' | 'audio' | 'video' | 'gif' | 'emoji' | 'image'
  content: string | null
  media_url: string | null
  is_deleted: boolean
  created_at: string
  one_time_view?: boolean
}

export default function MessageBubble({
  msg,
  isMine,
  selectMode,
  selected,
  selectable,
  onToggleSelect,
  onLongPress,
  formatTime,
  sending,
  receipt,
  onMediaConsumed,
}: {
  msg: Message
  isMine: boolean
  selectMode: boolean
  selected: boolean
  selectable: boolean
  onToggleSelect: () => void
  onLongPress: () => void
  formatTime: (s: string) => string
  sending?: boolean
  receipt?: 'sending' | 'delivered' | 'seen'
  onMediaConsumed?: (msgId: string) => void
}) {
  const isMultimedia = msg.type === 'audio' || msg.type === 'video' || msg.type === 'image' || msg.type === 'gif'
  const isOneTime = Boolean(msg.one_time_view) && isMultimedia
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const [lightbox, setLightbox] = useState<LightboxMedia | null>(null)
  const [mediaHidden, setMediaHidden] = useState(isMultimedia)
  const [mediaConsumed, setMediaConsumed] = useState(false)

  function revealAndConsume() {
    if (mediaHidden) {
      setMediaHidden(false)
      console.log('[MessageBubble] multimedia revelado:', msg.id, msg.type)
    }
  }

  function consume() {
    if (!mediaConsumed) {
      setMediaConsumed(true)
      console.log('[MessageBubble] multimedia consumido:', msg.id, msg.type)
      if (onMediaConsumed) onMediaConsumed(msg.id)
    }
  }

  function openMedia() {
    if (longPressed.current) {
      longPressed.current = false
      return
    }
    if (selectMode && selectable) {
      onToggleSelect()
      return
    }

    // Si es multimedia oculto, al hacer clic primero revela; si ya está revelado, abre lightbox
    if (isMultimedia && msg.media_url) {
      if (mediaHidden) {
        setMediaHidden(false)
        console.log('[MessageBubble] clic en multimedia oculto -> revelado')
        // Para image/gif/video, luego de revelar abrimos lightbox inmediatamente
        if (msg.type === 'image' || msg.type === 'gif' || msg.type === 'video') {
          setLightbox({ type: msg.type as 'image' | 'gif' | 'video', url: msg.media_url, sender_alias: msg.sender_alias })
        }
        return
      }
      // Si ya está revelado y es imagen/gif/video, abrir lightbox
      if (msg.type === 'image' || msg.type === 'gif' || msg.type === 'video') {
        setLightbox({ type: msg.type as 'image' | 'gif' | 'video', url: msg.media_url, sender_alias: msg.sender_alias })
      }
      return
    }
  }

  // Si el mensaje es multimedia consumido, mostrar como borrado pero visible
  const isConsumed = mediaConsumed || msg.is_deleted

  function handlePointerDown() {
    if (!isMine) return
    longPressed.current = false
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      onLongPress()
    }, 600)
  }

  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  function handleClick() {
    if (longPressed.current) {
      longPressed.current = false
      return
    }
    if (selectMode && selectable) onToggleSelect()
  }

  return (
    <div
      className="msg-enter"
      style={{
        display: 'flex',
        flexDirection: isMine ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: '6px',
        marginBottom: '4px',
      }}
    >
      {!isMine && (
        <div
          style={{
            width: '26px',
            height: '26px',
            minWidth: '26px',
            background: '#1e1e3a',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            color: '#8b5cf6',
            fontWeight: '600',
            marginBottom: '2px',
          }}
        >
          {msg.sender_alias[0]?.toUpperCase()}
        </div>
      )}

      <div
        style={{
          maxWidth: 'min(65%, 380px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMine ? 'flex-end' : 'flex-start',
        }}
      >
        {!isMine && (
          <span style={{ fontSize: '11px', color: '#6b6b8a', marginBottom: '2px', paddingLeft: '4px' }}>
            @{msg.sender_alias}
          </span>
        )}

        <div style={{ position: 'relative' }}>
          <div
            onPointerDown={handlePointerDown}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onClick={handleClick}
            style={{
              position: 'relative',
              background: isMine
                ? 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(124,58,237,0.16))'
                : '#14142a',
              border: selected
                ? '1px solid #ef4444'
                : `1px solid ${isMine ? 'rgba(139,92,246,0.3)' : '#1e1e3a'}`,
              borderRadius: isMine ? '14px 3px 14px 14px' : '3px 14px 14px 14px',
              padding: msg.type === 'emoji' ? '6px 10px' : '10px 13px',
              cursor: selectMode && selectable ? 'pointer' : 'default',
              minWidth: '60px',
              overflow: 'hidden',
              boxShadow: selected ? '0 0 0 1px rgba(239,68,68,0.4)' : 'none',
              userSelect: selectMode ? 'none' : 'text',
              opacity: sending ? 0.65 : 1,
            }}
          >
            {sending && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: isMine ? '6px' : 'auto',
                  left: isMine ? 'auto' : '6px',
                  zIndex: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 8px',
                  background: 'rgba(0,0,0,0.45)',
                  borderRadius: '10px',
                  color: '#fbbf24',
                  fontSize: '9px',
                  fontWeight: '700',
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: '0.05em',
                  pointerEvents: 'none',
                }}
              >
                <span
                  className="animate-pulse"
                  style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }}
                />
                ENVIANDO…
              </span>
            )}
            {/* Vista única / oculto badge */}
            {isMultimedia && (
              <div
                title={mediaHidden ? 'Oculto: toca para revelar' : 'Multimedia'}
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: isMine ? 'auto' : '6px',
                  left: isMine ? '6px' : 'auto',
                  zIndex: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  background: mediaHidden ? 'rgba(139,92,246,0.35)' : 'rgba(0,0,0,0.55)',
                  borderRadius: '10px',
                  color: mediaHidden ? '#8b5cf6' : '#fbbf24',
                  fontSize: '9px',
                  fontWeight: '700',
                  fontFamily: "'DM Mono', monospace",
                  pointerEvents: 'none',
                }}
              >
                {mediaHidden ? '🔒 OCULTO' : isConsumed ? '🗑️ BORRADO' : '📁 MEDIA'}
              </div>
            )}

            {/* Selection indicator */}
            {selectMode && selectable && (
              <div
                style={{
                  position: 'absolute',
                  top: '-8px',
                  left: isMine ? 'auto' : '-8px',
                  right: isMine ? '-8px' : 'auto',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: selected ? '#ef4444' : '#0f0f1e',
                  border: `1px solid ${selected ? '#ef4444' : '#3d3d5c'}`,
                  color: '#fff',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 5,
                }}
              >
                {selected ? '✓' : ''}
              </div>
            )}

            {msg.type === 'text' && (
              <p style={{ margin: 0, fontSize: '14px', color: '#e8e8f0', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {msg.content}
              </p>
            )}
            {msg.type === 'emoji' && (
              <p style={{ margin: 0, fontSize: '32px', lineHeight: '1.2' }}>{msg.content}</p>
            )}

            {/* Multimedia oculto / revelado / consumido */}
            {msg.type === 'gif' && msg.media_url && (
              mediaHidden ? (
                <div
                  onClick={() => { revealAndConsume(); openMedia() }}
                  style={{
                    width: '120px', height: '90px', borderRadius: '6px',
                    background: 'linear-gradient(135deg, #2a2a3e, #1e1e3a)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#8b5cf6', fontWeight: '700', fontSize: '12px',
                    border: '1px dashed rgba(139,92,246,0.3)', cursor: 'pointer',
                  }}
                >
                  🔒 Tocar para ver GIF
                </div>
              ) : isConsumed ? (
                <div style={{ fontSize: '12px', color: '#3d3d5c', padding: '6px 0' }}>
                  🗑️ GIF consumido (eliminado)
                </div>
              ) : (
                <img
                  src={msg.media_url}
                  alt="GIF"
                  onClick={(e) => { e.stopPropagation(); openMedia() }}
                  onLoad={() => console.log('[MessageBubble] GIF cargado:', msg.id)}
                  style={{ maxWidth: '220px', maxHeight: '160px', borderRadius: '6px', display: 'block', cursor: 'pointer' }}
                  loading="lazy"
                />
              )
            )}

            {msg.type === 'image' && msg.media_url && (
              mediaHidden ? (
                <div
                  onClick={() => { revealAndConsume(); openMedia() }}
                  style={{
                    width: '140px', height: '100px', borderRadius: '6px',
                    background: 'linear-gradient(135deg, #2a2a3e, #1e1e3a)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#8b5cf6', fontWeight: '700', fontSize: '12px',
                    border: '1px dashed rgba(139,92,246,0.3)', cursor: 'pointer',
                  }}
                >
                  🔒 Tocar para ver imagen
                </div>
              ) : isConsumed ? (
                <div style={{ fontSize: '12px', color: '#3d3d5c', padding: '6px 0' }}>
                  🗑️ Imagen consumida (eliminado)
                </div>
              ) : (
                <img
                  src={msg.media_url}
                  alt={msg.content ?? 'Imagen'}
                  onClick={(e) => { e.stopPropagation(); openMedia() }}
                  style={{ width: '100%', maxWidth: '280px', maxHeight: '240px', height: 'auto', borderRadius: '6px', display: 'block', objectFit: 'contain', cursor: 'pointer' }}
                  loading="lazy"
                />
              )
            )}

            {msg.type === 'audio' && msg.media_url && (
              mediaHidden ? (
                <div
                  onClick={() => { revealAndConsume() }}
                  style={{
                    padding: '8px 14px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(124,58,237,0.1))',
                    border: '1px dashed rgba(139,92,246,0.35)',
                    color: '#8b5cf6', fontWeight: '600', fontSize: '13px',
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  🔒 Tocar para escuchar audio (1 vez)
                </div>
              ) : isConsumed ? (
                <div style={{ fontSize: '12px', color: '#3d3d5c', padding: '4px 0' }}>
                  🗑️ Audio consumido (eliminado)
                </div>
              ) : (
                <audio
                  controls
                  src={msg.media_url}
                  style={{ maxWidth: '220px', height: '38px' }}
                  onEnded={() => { console.log('[MessageBubble] audio terminado -> consumiendo:', msg.id); consume() }}
                />
              )
            )}

            {msg.type === 'video' && msg.media_url && (
              mediaHidden ? (
                <div
                  onClick={() => { revealAndConsume(); openMedia() }}
                  style={{
                    width: '160px', height: '100px', borderRadius: '6px',
                    background: 'linear-gradient(135deg, #2a2a3e, #1e1e3a)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#8b5cf6', fontWeight: '700', fontSize: '12px',
                    border: '1px dashed rgba(139,92,246,0.3)', cursor: 'pointer',
                  }}
                >
                  🔒 Tocar para ver video
                </div>
              ) : isConsumed ? (
                <div style={{ fontSize: '12px', color: '#3d3d5c', padding: '6px 0' }}>
                  🗑️ Video consumido (eliminado)
                </div>
              ) : (
                <video
                  controls
                  playsInline
                  src={msg.media_url}
                  onEnded={() => { console.log('[MessageBubble] video terminado -> consumiendo:', msg.id); consume() }}
                  onClick={(e) => { e.stopPropagation(); openMedia() }}
                  style={{ width: '100%', maxWidth: '320px', maxHeight: '280px', height: 'auto', borderRadius: '6px', display: 'block', objectFit: 'contain', cursor: 'pointer' }}
                />
              )
            )}
          </div>
        </div>

        {/* Meta row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            marginTop: '3px',
            padding: isMine ? '0 4px 0 0' : '0 0 0 4px',
          }}
        >
          <span style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace" }}>
            {formatTime(msg.created_at)}
          </span>
          {isMine && receipt && (
            <span
              title={
                receipt === 'sending' ? 'Enviando…' : receipt === 'seen' ? 'Visto' : 'Entregado'
              }
              style={{
                fontSize: '10px',
                color: receipt === 'seen' ? '#22d3ee' : '#3d3d5c',
                lineHeight: 1,
                letterSpacing: '-1px',
              }}
            >
              {receipt === 'sending' ? '⏱' : receipt === 'seen' ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>

      <MediaLightbox
        media={lightbox}
        onClose={() => { setLightbox(null); consume(); }}
      />
    </div>
  )
}
