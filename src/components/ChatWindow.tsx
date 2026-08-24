import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import MessageBubble, { type Message } from './MessageBubble'
import { subscribeTyping, notifyChatChanged, onChatChanged, usePendingMessages } from '../lib/realtime'
import { deleteMediaFiles } from '../lib/media'
import { expiryCutoff } from '../lib/expire'
import DurationSettingsModal from './DurationSettingsModal'
import { callManager } from '../lib/call'

type Props = {
  groupId: string
  groupName: string
  refresh: number
  onMenuToggle: () => void
  onShowMembers: () => void
  isMobile: boolean
}

export default function ChatWindow({ groupId, groupName, refresh, onMenuToggle, onShowMembers, isMobile }: Props) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [receipts, setReceipts] = useState<Record<string, 'delivered' | 'seen'>>({})
  const [memberCount, setMemberCount] = useState(0)
  const [isCreator, setIsCreator] = useState(false)
  const [autoDeleteHours, setAutoDeleteHours] = useState<number>(24)
  const [showSettings, setShowSettings] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [typings, setTypings] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = usePendingMessages(`group-${groupId}`)

  async function handleStartCall() {
    if (!user) return
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
    const ids = [...new Set([...(members ?? []).map((m: any) => m.user_id), user.id])]
    const { data: us } = await supabase.from('users').select('id, alias').in('id', ids)
    const participants = (us ?? []).map((u: any) => ({ userId: u.id, alias: u.alias }))
    callManager.startCall(groupId, participants)
  }

  const loadMessages = useCallback(async () => {
    if (!user) return

    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)

    const count = members?.length ?? 0
    setMemberCount(count)

    const { data: grpInfo } = await supabase
      .from('groups')
      .select('created_by, auto_delete_hours')
      .eq('id', groupId)
      .maybeSingle()
    setIsCreator((grpInfo as any)?.created_by === user.id)
    const groupHours = (grpInfo as any)?.auto_delete_hours ?? 24
    setAutoDeleteHours(groupHours)

    const cutoff = expiryCutoff(groupHours)

    const { data: rows } = await supabase
      .from('messages')
      .select('id, group_id, sender_id, type, content, media_url, is_deleted, delete_after, created_at, one_time_view')
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .is('deleted_at', null)

    if (!rows || rows.length === 0) { setMessages([]); return }

    // Borrado con motivo: más de 24h (el registro queda, se elimina el archivo)
    const staleIds = rows.filter((m: any) => new Date(m.created_at).getTime() < cutoff).map((m: any) => m.id)
    if (staleIds.length) {
      await supabase
        .from('messages')
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), delete_reason: '24h' })
        .in('id', staleIds)
      await deleteMediaFiles(...rows.filter((m: any) => staleIds.includes(m.id)).map((m: any) => m.media_url))
    }

    // Gracia vencida (delete_after ya pasó) → borrado con motivo 'viewed'
    const nowMs = Date.now()
    const graceExpired = rows.filter((m: any) => m.delete_after && new Date(m.delete_after).getTime() <= nowMs).map((m: any) => m.id)
    if (graceExpired.length) {
      await supabase
        .from('messages')
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), delete_reason: 'viewed' })
        .in('id', graceExpired)
      await deleteMediaFiles(...rows.filter((m: any) => graceExpired.includes(m.id)).map((m: any) => m.media_url))
    }

    const msgs = rows.filter((m: any) =>
      new Date(m.created_at).getTime() >= cutoff &&
      !graceExpired.includes(m.id)
    )
    if (msgs.length === 0) { setMessages([]); return }

    // Batch fetch sender aliases
    const senderIds = [...new Set(msgs.map((m: any) => m.sender_id).filter(Boolean))]
    const { data: senders } = senderIds.length
      ? await supabase.from('users').select('id, alias').in('id', senderIds)
      : { data: [] }
    const aliasMap = new Map((senders ?? []).map((s: any) => [s.id, s.alias]))

    setMessages(msgs.map((m: any) => ({
      id: m.id,
      group_id: m.group_id,
      sender_id: m.sender_id,
      sender_alias: aliasMap.get(m.sender_id) ?? 'usuario',
      type: m.type,
      content: m.content,
      media_url: m.media_url,
      is_deleted: m.is_deleted,
      created_at: m.created_at,
    })))

    // Estado de entrega en grupo: ✓ entregado / ✓✓ visto por todos los miembros
    const myIds = msgs.filter((m: any) => m.sender_id === user.id).map((m: any) => m.id)
    const newReceipts: Record<string, 'delivered' | 'seen'> = {}
    if (myIds.length) {
      const { data: viewRows } = await supabase
        .from('message_views')
        .select('message_id')
        .in('message_id', myIds)
      const perMsg = new Map<string, number>()
      for (const v of viewRows ?? []) perMsg.set(v.message_id, (perMsg.get(v.message_id) ?? 0) + 1)
      for (const id of myIds) newReceipts[id] = (perMsg.get(id) ?? 0) >= count ? 'seen' : 'delivered'
    }
    setReceipts(newReceipts)

    // Timer: recargar cuando venza la gracia más cercana para ocultar el mensaje
    if (graceTimer.current) clearTimeout(graceTimer.current)
    const nextGrace = msgs
      .map((m: any) => m.delete_after ? new Date(m.delete_after).getTime() : Infinity)
      .reduce((a, b) => Math.min(a, b), Infinity)
    if (nextGrace !== Infinity) {
      graceTimer.current = setTimeout(() => loadMessages(), Math.max(nextGrace - Date.now(), 1000))
    }

    // Visto por todos → programar borrado con 5 MINUTOS de gracia (no al instante)
    if (count > 0) {
      const otherIds = msgs.filter((m: any) => m.sender_id !== user.id).map((m: any) => m.id)
      if (otherIds.length) {
        const { data: viewed } = await supabase
          .from('message_views')
          .select('message_id')
          .in('message_id', otherIds)
          .eq('user_id', user.id)
        const viewedSet = new Set((viewed ?? []).map((v: any) => v.message_id))
        const toView = otherIds.filter((id) => !viewedSet.has(id))
        if (toView.length) {
          await supabase
            .from('message_views')
            .upsert(toView.map((id) => ({ message_id: id, user_id: user.id })), { onConflict: 'message_id,user_id' })
        }
        const { data: counts } = await supabase
          .from('message_views')
          .select('message_id')
          .in('message_id', otherIds)
        const perMsg = new Map<string, number>()
        for (const v of counts ?? []) perMsg.set(v.message_id, (perMsg.get(v.message_id) ?? 0) + 1)
        const fullyViewed = msgs.filter((m: any) =>
          m.sender_id !== user.id && m.one_time_view && (perMsg.get(m.id) ?? 0) >= count && !m.delete_after
        )
        if (fullyViewed.length) {
          // Vista única: breve gracia para que el último en verlo alcance a verlo
          const grace = new Date(Date.now() + 3 * 1000).toISOString()
          await supabase
            .from('messages')
            .update({ delete_after: grace })
            .in('id', fullyViewed.map((m: any) => m.id))
        }
      }
    }

    // Barrido: elimina archivos de mensajes ya marcados como borrados (restos de cron/faltantes)
    const { data: deletedRows } = await supabase
      .from('messages')
      .select('media_url')
      .eq('group_id', groupId)
      .eq('is_deleted', true)
      .not('media_url', 'is', null)
      .gt('deleted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50)
    if (deletedRows?.length) {
      await deleteMediaFiles(...deletedRows.map((r: any) => r.media_url))
    }
  }, [groupId, user])

  useEffect(() => { loadMessages() }, [loadMessages, refresh])

  useEffect(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setReceipts({})
    if (graceTimer.current) clearTimeout(graceTimer.current)
  }, [groupId])

  useEffect(() => {
    const cleanup = subscribeTyping(`group-${groupId}`, (alias) => {
      setTypings((prev) => {
        if (prev.includes(alias)) return prev
        return [...prev, alias]
      })
      clearTimeout(typingTimers.current.get(alias))
      typingTimers.current.set(alias, setTimeout(() => {
        setTypings((prev) => prev.filter((a) => a !== alias))
      }, 2500))
    })
    return () => {
      cleanup()
      typingTimers.current.forEach((t) => clearTimeout(t))
    }
  }, [groupId])

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, loadMessages)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_views' }, loadMessages)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [groupId, loadMessages])

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
    const { data: selRows } = await supabase.from('messages').select('media_url').in('id', ids)
    // Borrado con registro: motivo 'manual'; se elimina el archivo del mensaje
    await supabase
      .from('messages')
      .update({ is_deleted: true, deleted_at: new Date().toISOString(), delete_reason: 'manual' })
      .in('id', ids)
    if (selRows?.length) await deleteMediaFiles(...selRows.map((r: any) => r.media_url))
    setSelectedIds(new Set())
    setSelectMode(false)
    notifyChatChanged()
    loadMessages()
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  const [copied, setCopied] = useState(false)

  async function shareGroup() {
    const link = `${window.location.origin}${window.location.pathname}?grupo=${groupId}`
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = link
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const typerLabel = typings.length ? `@${typings[0]} escribiendo…` : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#070711', position: 'relative' }}>
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
            background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(34,211,238,0.2))',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            color: '#c4b5fd',
            fontWeight: '700',
            border: '1px solid rgba(139,92,246,0.2)',
          }}
        >
          {groupName[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontWeight: '600', color: '#e8e8f0', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {groupName}
          </div>
          <div style={{ fontSize: '11px', color: typerLabel ? '#fbbf24' : '#3d3d5c', fontFamily: typerLabel ? "'Outfit', sans-serif" : "'DM Mono', monospace" }}>
            {typerLabel ? (
              <span className="animate-pulse" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                {typerLabel}
              </span>
            ) : (
              `${memberCount} MIEMBRO${memberCount !== 1 ? 'S' : ''}`
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {(isCreator || user?.is_admin) && (
            <button
              onClick={() => setShowSettings(true)}
              title="Configurar duración de borrado del grupo"
              style={{
                background: '#14142a',
                border: '1px solid #1e1e3a',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                color: '#6b6b8a',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ⚙️
            </button>
          )}
          {isCreator && (
            <button
              onClick={shareGroup}
              title="Compartir el grupo (solo el creador)"
              style={{
                padding: '3px 10px',
                background: 'rgba(34,211,238,0.08)',
                border: '1px solid rgba(34,211,238,0.25)',
                borderRadius: '20px',
                fontSize: '11px',
                color: '#22d3ee',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif",
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              ⇪ Compartir
            </button>
          )}
          <button
            onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()) }}
            title="Seleccionar mensajes"
            style={{
              background: selectMode ? 'rgba(239,68,68,0.12)' : '#14142a',
              border: `1px solid ${selectMode ? 'rgba(239,68,68,0.35)' : '#1e1e3a'}`,
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              color: selectMode ? '#f87171' : '#6b6b8a',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ☑
          </button>
          <button
            onClick={handleStartCall}
            title="Llamar (audio)"
            style={{
              background: '#14142a',
              border: '1px solid #1e1e3a',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              color: '#22c55e',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            📞
          </button>
          <button
            onClick={onShowMembers}
            title="Ver miembros"
            style={{
              background: '#14142a',
              border: '1px solid #1e1e3a',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              color: '#6b6b8a',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            👥
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#3d3d5c', gap: '10px', minHeight: '200px' }}>
            <div style={{ fontSize: '36px', opacity: 0.3 }}>◈</div>
            <p style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", margin: 0 }}>SIN MENSAJES · ENVÍA EL PRIMERO</p>
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

      {/* Popup de enlace copiado */}
      {copied && (
        <div
          style={{
            position: 'absolute',
            top: '64px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15,15,30,0.97)',
            border: '1px solid rgba(34,211,238,0.35)',
            borderRadius: '12px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 300,
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            fontFamily: "'Outfit', sans-serif",
            animation: 'msg-enter 0.25s ease',
          }}
        >
          <span style={{ fontSize: '16px' }}>✅</span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#e8e8f0' }}>
            Enlace copiado — compártelo
          </span>
        </div>
      )}

      {showSettings && (
        <DurationSettingsModal
          title={`Duración de borrado · ${groupName}`}
          current={autoDeleteHours}
          onClose={() => setShowSettings(false)}
          onSave={async (hours) => {
            await supabase.from('groups').update({ auto_delete_hours: hours }).eq('id', groupId)
            setShowSettings(false)
            loadMessages()
          }}
        />
      )}
    </div>
  )
}