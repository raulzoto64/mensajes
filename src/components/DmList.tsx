import { useState, useEffect } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOnlineUsers } from '../lib/realtime'
import { lastSeenLabel } from '../lib/time'

type DM = {
  conversationId: string
  otherUserId: string
  otherAlias: string
  otherLastSeen: string | null
  unreadCount: number
}

type Props = {
  activeDmId: string | null
  onSelectDm: (conversationId: string, otherUserId: string, otherAlias: string) => void
}

export default function DmList({ activeDmId, onSelectDm }: Props) {
  const { user } = useAuth()
  const onlineUsers = useOnlineUsers(user?.id ?? null)
  const [dms, setDms] = useState<DM[]>([])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: string; alias: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadDms()
    const channel = supabase
      .channel('dmlist-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_conversations' }, loadDms)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, loadDms)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_message_views' }, loadDms)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function loadDms() {
    if (!user) return
    const { data: convs } = await supabase
      .from('direct_conversations')
      .select('id, user_a, user_b, created_at')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

    if (!convs || convs.length === 0) { setDms([]); setLoading(false); return }

    const convIds = convs.map((c: any) => c.id)
    const { data: msgs } = await supabase
      .from('direct_messages')
      .select('id, conversation_id, sender_id')
      .in('conversation_id', convIds)
      .eq('is_deleted', false)

    const otherIds = convs.map((c: any) => c.user_a === user.id ? c.user_b : c.user_a)
    const { data: others } = await supabase.from('users').select('id, alias, last_seen_at').in('id', otherIds)
    const aliasMap = new Map((others ?? []).map((o: any) => [o.id, o.alias]))
    const lastSeenMap = new Map((others ?? []).map((o: any) => [o.id, o.last_seen_at ?? null]))

    const liveMsgs = (msgs ?? []).filter((m: any) => convIds.includes(m.conversation_id))
    const msgIds = liveMsgs.map((m: any) => m.id)
    const { data: viewed } = msgIds.length
      ? await supabase.from('direct_message_views').select('message_id').in('message_id', msgIds).eq('user_id', user.id)
      : { data: [] }
    const viewedSet = new Set((viewed ?? []).map((v: any) => v.message_id))

    const unreadByConv = new Map<string, number>()
    for (const m of liveMsgs) {
      if (m.sender_id !== user.id && !viewedSet.has(m.id)) {
        unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1)
      }
    }

    const lastActivity = new Map<string, number>()
    for (const c of convs) lastActivity.set(c.id, new Date(c.created_at).getTime())
    for (const m of liveMsgs) {
      const t = Date.now()
      if (t > (lastActivity.get(m.conversation_id) ?? 0)) lastActivity.set(m.conversation_id, t)
    }

    const list: DM[] = convs.map((c: any) => {
      const otherId = c.user_a === user.id ? c.user_b : c.user_a
      return {
        conversationId: c.id,
        otherUserId: otherId,
        otherAlias: aliasMap.get(otherId) ?? 'usuario',
        otherLastSeen: lastSeenMap.get(otherId) ?? null,
        unreadCount: unreadByConv.get(c.id) ?? 0,
      }
    }).sort((a, b) => {
      if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount
      return (lastActivity.get(b.conversationId) ?? 0) - (lastActivity.get(a.conversationId) ?? 0)
    })

    setDms(list)
    setLoading(false)
  }

  async function searchUsers(q: string) {
    if (!user) return
    const { data } = await supabase
      .from('users')
      .select('id, alias')
      .ilike('alias', `%${q.toLowerCase()}%`)
      .neq('id', user.id)
      .limit(8)
    setResults((data ?? []).map((r: any) => ({ id: r.id, alias: r.alias })))
  }

  async function startDm(otherId: string, otherAlias: string) {
    if (!user) return
    const [a, b] = [user.id, otherId].map((s) => `${s}`).sort()
    let { data: conv } = await supabase
      .from('direct_conversations')
      .select('id')
      .eq('user_a', a)
      .eq('user_b', b)
      .maybeSingle()
    if (!conv) {
      const { data: created } = await supabase
        .from('direct_conversations')
        .insert({ user_a: a, user_b: b })
        .select('id')
        .single()
      conv = created
    }
    if (conv) {
      setSearch('')
      setResults([])
      loadDms()
      onSelectDm(conv.id, otherId, otherAlias)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111b21' }}>Chats</h2>
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (e.target.value.trim()) searchUsers(e.target.value.trim())
              else setResults([])
            }}
            placeholder="Buscar usuario @alias..."
            style={{
              width: '100%',
              background: '#f0f2f5',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              padding: '10px 12px 10px 36px',
              color: '#111b21',
              fontSize: '13px',
              fontFamily: "'Outfit', sans-serif",
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#00a884')}
            onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#adb5bd', pointerEvents: 'none' }}>
            🔍
          </span>
        </div>
        {/* Search results */}
        {results.length > 0 && (
          <div style={{ marginTop: '8px', border: '1px solid #e5e7eb', borderRadius: '10px', background: '#ffffff', overflow: 'hidden' }}>
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => startDm(u.id, u.alias)}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,168,132,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onMouseDown={(e) => (e.currentTarget.style.background = 'rgba(0,168,132,0.14)')}
                onMouseUp={(e) => (e.currentTarget.style.background = 'rgba(0,168,132,0.06)')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid #f0f2f5',
                  color: '#111b21',
                  fontSize: '13px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'rgba(0,168,132,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', color: '#00a884', fontWeight: '700', flexShrink: 0,
                }}>
                  {u.alias[0]?.toUpperCase()}
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: '#00a884' }}>@{u.alias}</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#0088cc' }}>↗</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DM list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {!supabaseConfigured && (
          <div style={{ margin: '8px', padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', fontSize: '11px', color: '#fbbf24', fontFamily: "'DM Mono', monospace", lineHeight: '1.5' }}>
            ⚠ SUPABASE NO CONFIGURADO
          </div>
        )}
        {loading && dms.length === 0 && (
          <p style={{ color: '#adb5bd', fontSize: '12px', textAlign: 'center', padding: '40px 20px' }}>Cargando...</p>
        )}
        {!loading && dms.length === 0 && (
          <p style={{ color: '#adb5bd', fontSize: '12px', textAlign: 'center', padding: '40px 20px' }}>
            Sin conversaciones privadas
          </p>
        )}
        {dms.map((d) => {
          const active = activeDmId === d.conversationId
          return (
            <button
              key={d.conversationId}
              onClick={() => onSelectDm(d.conversationId, d.otherUserId, d.otherAlias)}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(0,168,132,0.06)' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
              onMouseDown={(e) => { if (!active) e.currentTarget.style.background = 'rgba(0,168,132,0.14)' }}
              onMouseUp={(e) => { if (!active) e.currentTarget.style.background = 'rgba(0,168,132,0.06)' }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                background: active ? 'rgba(0,168,132,0.12)' : 'transparent',
                border: `1px solid ${active ? 'rgba(0,168,132,0.25)' : 'transparent'}`,
                borderRadius: '10px',
                cursor: 'pointer',
                marginBottom: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontFamily: "'Outfit', sans-serif",
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <div style={{
                width: '40px', height: '40px', minWidth: '40px', borderRadius: '50%',
                background: active ? '#00a884' : '#f0f2f5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', color: active ? '#fff' : '#8696a0', fontWeight: '700',
              }}>
                {d.otherAlias[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{
                  fontSize: '14px', fontWeight: d.unreadCount > 0 ? '600' : '400',
                  color: active ? '#111b21' : d.unreadCount > 0 ? '#0088cc' : '#667781',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  @{d.otherAlias}
                </div>
                <div style={{ fontSize: '11px', color: onlineUsers.has(d.otherUserId) ? '#25d366' : '#adb5bd' }}>
                  {onlineUsers.has(d.otherUserId) ? 'En línea' : lastSeenLabel(d.otherLastSeen)}
                </div>
              </div>
              <div style={{
                width: '8px', height: '8px', minWidth: '8px', borderRadius: '50%',
                background: onlineUsers.has(d.otherUserId) ? '#25d366' : '#adb5bd', flexShrink: 0,
              }} />
              {d.unreadCount > 0 && !active && (
                <div style={{
                  minWidth: '20px', height: '20px', background: '#0088cc', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '700', color: '#f0f2f5', padding: '0 5px',
                }}>
                  {d.unreadCount > 99 ? '99+' : d.unreadCount}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
