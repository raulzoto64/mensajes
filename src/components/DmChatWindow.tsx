import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import MessageBubble, { type Message } from './MessageBubble'
import { useOnlineUsers, subscribeTyping, notifyChatChanged, onChatChanged, usePendingMessages } from '../lib/realtime'
import { lastSeenLabel } from '../lib/time'
import { deleteMediaFiles } from '../lib/media'
import { expiryCutoff } from '../lib/expire'
import DurationSettingsModal from './DurationSettingsModal'
import { callManager } from '../lib/call'

type Props = {
  conversationId: string
  otherUserId: string
  otherAlias: string
  onMenuToggle: () => void
  isMobile: boolean
}

export default function DmChatWindow({ conversationId, otherUserId, otherAlias, onMenuToggle, isMobile }: Props) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [receipts, setReceipts] = useState<Record<string, 'delivered' | 'seen'>>({})
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [typing, setTyping] = useState(false)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [autoDeleteHours, setAutoDeleteHours] = useState<number>(24)
  const [showSettings, setShowSettings] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onlineUsers = useOnlineUsers(user?.id ?? null)
  const pending = usePendingMessages(`dm-${conversationId}`)

  const loadMessages = useCallback(async () => {
    if (!user) return

    const { data: convInfo } = await supabase
      .from('direct_conversations')
      .select('auto_delete_hours')
      .eq('id', conversationId)
      .maybeSingle()
    const convHours = (convInfo as any)?.auto_delete_hours ?? 24
    setAutoDeleteHours(convHours)

    const { data: msgs } = await supabase
      .from('direct_messages')
      .select('id, conversation_id, sender_id, type, content, media_url, is_deleted, delete_after, created_at, one_time_view')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    // Borrado con motivo: pasada la duración configurada de la conversación
    const cutoff = expiryCutoff(convHours)
    const staleIds = (msgs ?? []).filter((m: any) => new Date(m.created_at).getTime() < cutoff).map((m: any) => m.id)
    if (staleIds.length) {
      await supabase
        .from('direct_messages')
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), delete_reason: '24h' })
        .in('id', staleIds)
      await deleteMediaFiles(...(msgs ?? []).filter((m: any) => staleIds.includes(m.id)).map((m: any) => m.media_url))
    }

    // Gracia vencida (delete_after ya pasó) → borrado con motivo 'viewed' o vaciado de cascarón
    const nowMs = Date.now()
    const graceExpiredRows = (msgs ?? []).filter((m: any) => m.delete_after && new Date(m.delete_after).getTime() <= nowMs)
    const normalExpired = graceExpiredRows.filter((m: any) => !m.one_time_view).map((m: any) => m.id)
    const oneTimeExpired = graceExpiredRows.filter((m: any) => m.one_time_view).map((m: any) => m.id)

    if (graceExpiredRows.length) {
      if (normalExpired.length) {
        await supabase
          .from('direct_messages')
          .update({ is_deleted: true, deleted_at: new Date().toISOString(), delete_reason: 'viewed' })
          .in('id', normalExpired)
      }
      if (oneTimeExpired.length) {
        // En vista única, no borramos el mensaje, lo dejamos como "cascarón" (evidencia)
        await supabase
          .from('direct_messages')
          .update({ content: null, media_url: null, delete_after: null })
          .in('id', oneTimeExpired)
      }
      await deleteMediaFiles(...graceExpiredRows.map((m: any) => m.media_url))
    }

    const liveMsgs = (msgs ?? []).filter((m: any) =>
      new Date(m.created_at).getTime() >= cutoff &&
      !normalExpired.includes(m.id)
    )
    if (liveMsgs.length === 0) { setMessages([]); return }

    const senderIds = [...new Set(liveMsgs.map((m: any) => m.sender_id).filter(Boolean))]
    const { data: senders } = senderIds.length
      ? await supabase.from('users').select('id, alias').in('id', senderIds)
      : { data: [] }
    const aliasMap = new Map((senders ?? []).map((s: any) => [s.id, s.alias]))

    setMessages(liveMsgs.map((m: any) => ({
      id: m.id,
      sender_id: m.sender_id,
      sender_alias: aliasMap.get(m.sender_id) ?? 'usuario',
      type: m.type,
      content: m.content,
      media_url: m.media_url,
      is_deleted: m.is_deleted,
      created_at: m.created_at,
      one_time_view: m.one_time_view,
    })))

    // Estado de entrega: ✓ entregado / ✓✓ visto por el otro usuario
    const myIds = liveMsgs.filter((m: any) => m.sender_id === user.id).map((m: any) => m.id)
    const newReceipts: Record<string, 'delivered' | 'seen'> = {}
    if (myIds.length) {
      const { data: views } = await supabase
        .from('direct_message_views')
        .select('message_id')
        .eq('user_id', otherUserId)
        .in('message_id', myIds)
      const seen = new Set((views ?? []).map((v: any) => v.message_id))
      for (const id of myIds) newReceipts[id] = seen.has(id) ? 'seen' : 'delivered'
    }
    setReceipts(newReceipts)

    // Timer: recargar cuando venza la gracia más cercana para ocultar el mensaje
    if (graceTimer.current) clearTimeout(graceTimer.current)
    const nextGrace = liveMsgs
      .map((m: any) => m.delete_after ? new Date(m.delete_after).getTime() : Infinity)
      .reduce((a, b) => Math.min(a, b), Infinity)
    if (nextGrace !== Infinity) {
      graceTimer.current = setTimeout(() => loadMessages(), Math.max(nextGrace - Date.now(), 1000))
    }

    // Visto por ambos → programar borrado con 5 MINUTOS de gracia (no al instante)
    const otherIds = liveMsgs.filter((m: any) => m.sender_id !== user.id).map((m: any) => m.id)
    if (otherIds.length) {
      const { data: viewed } = await supabase
        .from('direct_message_views')
        .select('message_id')
        .in('message_id', otherIds)
        .eq('user_id', user.id)
      const viewedSet = new Set((viewed ?? []).map((v: any) => v.message_id))
      const toView = otherIds.filter((id) => !viewedSet.has(id))
      if (toView.length) {
        await supabase
          .from('direct_message_views')
          .upsert(toView.map((id) => ({ message_id: id, user_id: user.id })), { onConflict: 'message_id,user_id' })
      }
      const { data: counts } = await supabase
        .from('direct_message_views')
        .select('message_id')
        .in('message_id', otherIds)
      const perMsg = new Map<string, number>()
      for (const v of counts ?? []) perMsg.set(v.message_id, (perMsg.get(v.message_id) ?? 0) + 1)
      const fullyViewed = liveMsgs.filter((m: any) =>
        m.sender_id !== user.id && m.one_time_view && (perMsg.get(m.id) ?? 0) >= 2 && !m.delete_after
      )
      if (fullyViewed.length) {
        // Vista única: gracia de 15 segundos para que el otro alcance a verlo
        const grace = new Date(Date.now() + 15 * 1000).toISOString()
        await supabase
          .from('direct_messages')
          .update({ delete_after: grace })
          .in('id', fullyViewed.map((m: any) => m.id))
      }
    }

    // Barrido: elimina archivos de mensajes ya borrados (restos de cron/faltantes)
    const { data: deletedRows } = await supabase
      .from('direct_messages')
      .select('media_url')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', true)
      .not('media_url', 'is', null)
      .gt('deleted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50)
    if (deletedRows?.length) {
      await deleteMediaFiles(...deletedRows.map((r: any) => r.media_url))
    }
  }, [conversationId, user])

  useEffect(() => { loadMessages() }, [loadMessages])

  useEffect(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setReceipts({})
    if (graceTimer.current) clearTimeout(graceTimer.current)
  }, [conversationId])

  useEffect(() => {
    const cleanup = subscribeTyping(`dm-${conversationId}`, () => {
      setTyping(true)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setTyping(false), 2500)
    })
    return () => {
      cleanup()
      if (typingTimer.current) clearTimeout(typingTimer.current)
    }
  }, [conversationId])

  useEffect(() => {
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, loadMessages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_message_views' }, loadMessages)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, loadMessages])

  // Local refresh: reload instantly when a message is sent/deleted in this session
  useEffect(() => {
    const unsubscribe = onChatChanged(loadMessages)
    return unsubscribe
  }, [loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, pending.length])

  function toggleSelect(msgId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  function handleLongPress(msgId: string) {
    setSelectMode(true)
    setSelectedIds((prev) => new Set(prev).add(msgId))
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return
    const ids = [...selectedIds]
    const { data: selRows } = await supabase.from('direct_messages').select('media_url').in('id', ids)
    // Borrado con registro: motivo 'manual'; se elimina el archivo del mensaje
    await supabase
      .from('direct_messages')
      .update({ is_deleted: true, deleted_at: new Date().toISOString(), delete_reason: 'manual' })
      .in('id', ids)
    if (selRows?.length) await deleteMediaFiles(...selRows.map((r: any) => r.media_url))
    setSelectedIds(new Set())
    setSelectMode(false)
    notifyChatChanged()
    loadMessages()
  }

  async function handleMediaConsumed(msgId: string) {
    console.log('[FRONT] DmChatWindow: multimedia consumido, limpiando media_url ->', msgId)
    // Obtener media_url antes de limpiar para borrar el archivo
    const { data: msgRow } = await supabase
      .from('direct_messages')
      .select('media_url')
      .eq('id', msgId)
      .maybeSingle()
    // Limpiar media_url y texto pero mantener el cascarón del mensaje
    await supabase
      .from('direct_messages')
      .update({ media_url: null, content: null, delete_after: null })
      .eq('id', msgId)
    // Borrar el archivo multimedia del storage
    if ((msgRow as any)?.media_url) await deleteMediaFiles((msgRow as any).media_url)
    loadMessages()
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  const isOnline = onlineUsers.has(otherUserId)

  function handleStartCall() {
    if (!user) return
    callManager.startCall(conversationId, [
      { userId: user.id, alias: user.alias },
      { userId: otherUserId, alias: otherAlias },
    ])
  }

  useEffect(() => {
    if (!otherUserId || isOnline) return
    let cancelled = false
    supabase
      .from('users')
      .select('last_seen_at')
      .eq('id', otherUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLastSeen((data as any)?.last_seen_at ?? null)
      })
    return () => { cancelled = true }
  }, [otherUserId, isOnline])

  const statusLabel = typing ? 'Escribiendo…' : isOnline ? 'En línea' : lastSeenLabel(lastSeen)
  const statusColor = typing ? '#fbbf24' : isOnline ? '#22c55e' : '#3d3d5c'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#070711' }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #1e1e3a',
          background: '#0a0a18',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        {isMobile && (
          <button
            onClick={onMenuToggle}
            style={{ background: 'transparent', border: 'none', color: '#6b6b8a', cursor: 'pointer', fontSize: '20px', padding: '2px 6px 2px 0', display: 'flex', alignItems: 'center' }}
          >
            ☰
          </button>
        )}
        <div
          style={{
            width: '36px',
            height: '36px',
            minWidth: '36px',
            background: 'rgba(34,211,238,0.15)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            color: '#67e8f9',
            fontWeight: '700',
            border: '1px solid rgba(34,211,238,0.25)',
          }}
        >
          {otherAlias[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontWeight: '600', color: '#e8e8f0', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{otherAlias}
          </div>
          <div style={{ fontSize: '11px', color: statusColor, fontFamily: typing ? "'Outfit', sans-serif" : "'DM Mono', monospace" }}>
            {typing ? (
              <span className="animate-pulse" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {statusLabel}
              </span>
            ) : (
              statusLabel
            )}
          </div>
        </div>
        <div
          style={{
            padding: '3px 9px',
            background: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.15)',
            borderRadius: '20px',
            fontSize: '10px',
            color: '#22d3ee',
            fontFamily: "'DM Mono', monospace",
            whiteSpace: 'nowrap',
          }}
        >
          ◉ PRIVADO
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            title="Más opciones"
            style={{
              background: '#14142a',
              border: '1px solid #1e1e3a',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              color: '#6b6b8a',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 300 }} />
              <div
                style={{
                  position: 'absolute',
                  top: '38px',
                  right: 0,
                  zIndex: 301,
                  minWidth: '190px',
                  background: '#0f0f1e',
                  border: '1px solid #2a2a50',
                  borderRadius: '10px',
                  padding: '6px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <MenuItem icon="⚙️" label="Configurar" onClick={() => { setMenuOpen(false); setShowSettings(true) }} />
                <MenuItem
                  icon="☑"
                  label="Seleccionar (marcar)"
                  onClick={() => { setMenuOpen(false); setSelectMode((v) => !v); setSelectedIds(new Set()) }}
                />
                <MenuItem icon="📞" label="Llamar (audio)" accent="#22c55e" onClick={() => { setMenuOpen(false); handleStartCall() }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#3d3d5c', gap: '10px', minHeight: '200px' }}>
            <div style={{ fontSize: '36px', opacity: 0.3 }}>◈</div>
            <p style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", margin: 0 }}>SIN MENSAJES · ENVÍA EL PRIMERO EN PRIVADO</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMine={msg.sender_id === user?.id}
            selectMode={selectMode}
            selected={selectedIds.has(msg.id)}
            selectable={selectMode && msg.sender_id === user?.id}
            onToggleSelect={() => toggleSelect(msg.id)}
            onLongPress={() => handleLongPress(msg.id)}
            formatTime={formatTime}
            receipt={msg.sender_id === user?.id ? (receipts[msg.id] ?? 'delivered') : undefined}
            onMediaConsumed={handleMediaConsumed}
          />
        ))}
        {pending.map((p) => (
          <MessageBubble
            key={p.tempId}
            msg={{
              id: p.tempId,
              sender_id: user?.id ?? '',
              sender_alias: user?.alias ?? '',
              type: p.type as Message['type'],
              content: p.content,
              media_url: p.mediaUrl,
              is_deleted: false,
              created_at: p.createdAt,
            }}
            isMine={true}
            selectMode={false}
            selected={false}
            selectable={false}
            onToggleSelect={() => {}}
            onLongPress={() => {}}
            formatTime={formatTime}
            sending
            receipt="sending"
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {showSettings && (
        <DurationSettingsModal
          title={`Duración de borrado · @${otherAlias}`}
          current={autoDeleteHours}
          onClose={() => setShowSettings(false)}
          onSave={async (hours) => {
            await supabase.from('direct_conversations').update({ auto_delete_hours: hours }).eq('id', conversationId)
            setShowSettings(false)
            loadMessages()
          }}
        />
      )}

      {/* Selection action bar */}
      {selectMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 16px',
            borderTop: '1px solid #1e1e3a',
            background: '#0a0a18',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '12px', color: '#6b6b8a', fontFamily: "'DM Mono', monospace" }}>
            {selectedIds.size} SELECCIONADO{selectedIds.size !== 1 ? 'S' : ''}
          </span>
          <button
            onClick={deleteSelected}
            disabled={selectedIds.size === 0}
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              padding: '6px 14px',
              color: selectedIds.size ? '#f87171' : '#3d3d5c',
              fontSize: '12px',
              fontWeight: '600',
              cursor: selectedIds.size ? 'pointer' : 'default',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Eliminar
          </button>
          <button
            onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
            style={{
              background: '#14142a',
              border: '1px solid #1e1e3a',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#6b6b8a',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, accent }: { icon: string; label: string; onClick: () => void; accent?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        textAlign: 'left',
        padding: '9px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: '7px',
        color: accent ?? '#e8e8f0',
        fontSize: '13px',
        cursor: 'pointer',
        fontFamily: "'Outfit', sans-serif",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontSize: '15px', width: '18px', textAlign: 'center' }}>{icon}</span>
      {label}
    </button>
  )
}