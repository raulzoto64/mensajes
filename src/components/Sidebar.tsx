import { useState, useEffect } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOnlineUsers, onChatChanged } from '../lib/realtime'
import { lastSeenLabel } from '../lib/time'
import { unsubscribePush } from '../lib/push'
import NotificationsPanel from './NotificationsPanel'
import { addNotification } from '../lib/notifications'

type Group = {
  id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  unreadCount: number
}

type DM = {
  conversationId: string
  otherUserId: string
  otherAlias: string
  otherLastSeen: string | null
  unreadCount: number
}

type Props = {
  activeGroupId: string | null
  activeDmId: string | null
  onSelectGroup: (id: string, name: string) => void
  onSelectDm: (conversationId: string, otherUserId: string, otherAlias: string) => void
  onAdminPanel: () => void
}

export default function Sidebar({ activeGroupId, activeDmId, onSelectGroup, onSelectDm, onAdminPanel }: Props) {
  const { user, logout } = useAuth()
  const onlineUsers = useOnlineUsers(user?.id ?? null)
  const [groups, setGroups] = useState<Group[]>([])
  const [allGroups, setAllGroups] = useState<{ id: string; name: string; description: string | null }[]>([])
  const [panel, setPanel] = useState<'none' | 'create' | 'join'>('none')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [dms, setDms] = useState<DM[]>([])
  const [dmSearch, setDmSearch] = useState('')
  const [dmResults, setDmResults] = useState<{ id: string; alias: string }[]>([])
  const [supabaseMissing] = useState(!supabaseConfigured)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!user) return
    loadMyGroups()
    loadDms()
    loadPendingCount()
    const channel = supabase
      .channel('sidebar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, (payload: any) => {
        if (payload.new?.user_id === user.id && payload.eventType === 'INSERT') {
          notifyAddedToGroup(payload.new.group_id)
        }
        loadMyGroups()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, loadMyGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload: any) => {
        if (payload.eventType === 'INSERT' && payload.new?.sender_id && payload.new?.sender_id !== user.id) {
          notifyNewGroupMessage(payload.new)
        }
        loadMyGroups()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_views' }, loadMyGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_conversations' }, loadDms)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, (payload: any) => {
        if (payload.eventType === 'INSERT' && payload.new?.sender_id && payload.new?.sender_id !== user.id) {
          notifyNewDm(payload.new)
        }
        loadDms()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_message_views' }, loadDms)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, (payload: any) => {
        // Notifica al admin cuando alguien nuevo se registra
        if (user?.is_admin && payload.new?.alias) {
          addNotification({
            type: 'approval',
            title: 'Solicitud de ingreso',
            body: `@${payload.new.alias} quiere entrar y espera tu aprobación`,
            userId: payload.new.id,
            userAlias: payload.new.alias,
          })
          loadPendingCount()
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => {
        if (user?.is_admin) loadPendingCount()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    const unsubscribe = onChatChanged(() => {
      loadMyGroups()
      loadDms()
    })
    return unsubscribe
  }, [user])

  async function loadPendingCount() {
    if (!user?.is_admin) return
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('is_approved', false)
    setPendingCount(count ?? 0)
  }

  async function notifyAddedToGroup(groupId: string) {
    if (!user) return
    const { data } = await supabase.from('groups').select('name').eq('id', groupId).maybeSingle()
    const name = (data as any)?.name ?? 'grupo'
    addNotification({
      type: 'group',
      title: `#${name}`,
      body: `Te agregaron a este grupo`,
      groupId,
      groupName: name,
    })
  }

  function msgPreview(row: any): string {
    const type = row.type
    const content = typeof row.content === 'string' && row.content.trim() ? row.content : null
    if (content) return content.length > 60 ? content.slice(0, 60) + '…' : content
    if (type === 'emoji') return 'Envió un emoji'
    if (type === 'gif') return 'Envió un GIF'
    if (type === 'image') return 'Envió una imagen'
    if (type === 'video') return 'Envió un video'
    if (type === 'audio') return 'Envió un audio'
    return 'Nuevo mensaje'
  }

  async function notifyNewGroupMessage(row: any) {
    if (!user) return
    const { data: member } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('group_id', row.group_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!member) return
    const [groupRes, senderRes] = await Promise.all([
      supabase.from('groups').select('name').eq('id', row.group_id).maybeSingle(),
      supabase.from('users').select('alias').eq('id', row.sender_id).maybeSingle(),
    ])
    const gname = (groupRes.data as any)?.name ?? 'grupo'
    const alias = (senderRes.data as any)?.alias ?? 'alguien'
    addNotification({
      type: 'group',
      title: `#${gname} · @${alias}`,
      body: msgPreview(row),
      groupId: row.group_id,
      groupName: gname,
    })
  }

  async function notifyNewDm(row: any) {
    if (!user) return
    const { data: conv } = await supabase
      .from('direct_conversations')
      .select('id, user_a, user_b')
      .eq('id', row.conversation_id)
      .maybeSingle()
    if (!conv) return
    const otherId = (conv as any).user_a === user.id ? (conv as any).user_b : (conv as any).user_a
    const { data: sender } = await supabase.from('users').select('alias').eq('id', otherId).maybeSingle()
    const alias = (sender as any)?.alias ?? 'alguien'
    addNotification({
      type: 'dm',
      title: `@${alias}`,
      body: msgPreview(row),
      conversationId: row.conversation_id,
      otherUserId: otherId,
      otherAlias: alias,
    })
  }

  async function loadMyGroups() {
    if (!user) return
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, description, created_by, created_at)')
      .eq('user_id', user.id)

    if (!memberships) return
    const gs = memberships.map((r: any) => r.groups).filter(Boolean) as Omit<Group, 'unreadCount'>[]

    // Count unread messages per group (not viewed by this user, not deleted)
    const groupIds = gs.map((g) => g.id)
    if (!groupIds.length) { setGroups([]); return }

    const { data: msgs } = await supabase
      .from('messages')
      .select('id, group_id, sender_id')
      .in('group_id', groupIds)
      .eq('is_deleted', false)

    const msgIds = (msgs ?? []).map((m: any) => m.id)
    const { data: viewed } = msgIds.length
      ? await supabase.from('message_views').select('message_id').in('message_id', msgIds).eq('user_id', user.id)
      : { data: [] }

    const viewedIds = new Set((viewed ?? []).map((v: any) => v.message_id))

    const unreadByGroup = new Map<string, number>()
    for (const m of msgs ?? []) {
      // No cuenta los propios ni los ya vistos
      if (m.sender_id !== user.id && !viewedIds.has(m.id)) {
        unreadByGroup.set(m.group_id, (unreadByGroup.get(m.group_id) ?? 0) + 1)
      }
    }

    setGroups(gs.map((g) => ({ ...g, unreadCount: unreadByGroup.get(g.id) ?? 0 })))
  }

  async function loadDms() {
    if (!user) return
    const { data: convs } = await supabase
      .from('direct_conversations')
      .select('id, user_a, user_b, created_at')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

    if (!convs || convs.length === 0) { setDms([]); return }

    const convIds = convs.map((c: any) => c.id)
    const { data: msgs } = await supabase
      .from('direct_messages')
      .select('id, conversation_id, sender_id, created_at')
      .in('conversation_id', convIds)
      .eq('is_deleted', false)

    const cutoff = Date.now() - 24 * 60 * 60 * 1000

    // Last activity per conversation (creation or last message), then delete inactive 24h ones
    const lastByConv = new Map<string, number>()
    for (const c of convs) lastByConv.set(c.id, new Date(c.created_at).getTime())
    for (const m of msgs ?? []) {
      const t = new Date(m.created_at).getTime()
      if (t > (lastByConv.get(m.conversation_id) ?? 0)) lastByConv.set(m.conversation_id, t)
    }
    const staleConvIds = convs.filter((c: any) => (lastByConv.get(c.id) ?? 0) < cutoff).map((c: any) => c.id)
    if (staleConvIds.length) {
      await supabase.from('direct_conversations').delete().in('id', staleConvIds)
    }

    const remainingConvs = convs.filter((c: any) => (lastByConv.get(c.id) ?? 0) >= cutoff)
    if (remainingConvs.length === 0) { setDms([]); return }

    const otherIds = remainingConvs.map((c: any) => (c.user_a === user.id ? c.user_b : c.user_a))
    const { data: others } = await supabase.from('users').select('id, alias, last_seen_at').in('id', otherIds)
    const aliasMap = new Map((others ?? []).map((o: any) => [o.id, o.alias]))
    const lastSeenMap = new Map((others ?? []).map((o: any) => [o.id, o.last_seen_at ?? null]))

    const remainingIds = remainingConvs.map((c: any) => c.id)
    const liveMsgs = (msgs ?? []).filter((m: any) => remainingIds.includes(m.conversation_id))

    // Hide conversations without any live (non-deleted) message
    const withMsgs = remainingConvs.filter((c: any) => liveMsgs.some((m: any) => m.conversation_id === c.id))
    if (withMsgs.length === 0) { setDms([]); return }

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

    const list: DM[] = withMsgs.map((c: any) => {
      const otherId = c.user_a === user.id ? c.user_b : c.user_a
      return {
        conversationId: c.id,
        otherUserId: otherId,
        otherAlias: aliasMap.get(otherId) ?? 'usuario',
        otherLastSeen: lastSeenMap.get(otherId) ?? null,
        unreadCount: unreadByConv.get(c.id) ?? 0,
      }
    })
    setDms(list.sort((a, b) => b.unreadCount - a.unreadCount))
  }

  async function searchUsers(q: string) {
    if (!user) return
    const { data } = await supabase
      .from('users')
      .select('id, alias')
      .ilike('alias', `%${q.toLowerCase()}%`)
      .neq('id', user.id)
      .limit(8)
    setDmResults((data ?? []).map((r: any) => ({ id: r.id, alias: r.alias })))
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
      setDmSearch('')
      setDmResults([])
      loadDms()
      onSelectDm(conv.id, otherId, otherAlias)
    }
  }

  async function loadAllGroups() {
    const { data } = await supabase.from('groups').select('id, name, description').order('created_at', { ascending: false })
    if (data) setAllGroups(data)
  }

  async function createGroup() {
    if (!newGroupName.trim() || !user) return
    setCreating(true)
    const { data: grp, error } = await supabase
      .from('groups')
      .insert({ name: newGroupName.trim(), description: newGroupDesc.trim() || null, created_by: user.id })
      .select()
      .single()
    if (!error && grp) {
      await supabase.from('group_members').insert({ group_id: grp.id, user_id: user.id })
      setNewGroupName('')
      setNewGroupDesc('')
      setPanel('none')
      onSelectGroup(grp.id, grp.name)
    }
    setCreating(false)
  }

  async function joinGroup(groupId: string, groupName: string) {
    if (!user) return
    await supabase.from('group_members').upsert({ group_id: groupId, user_id: user.id })
    setPanel('none')
    onSelectGroup(groupId, groupName)
  }

  const myGroupIds = new Set(groups.map((g) => g.id))

  return (
    <div
      style={{
        width: '280px',
        minWidth: '280px',
        height: '100%',
        background: '#0a0a18',
        borderRight: '1px solid #1e1e3a',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {/* Config warning */}
      {supabaseMissing && (
        <div
          style={{
            margin: '8px',
            padding: '10px 12px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: '10px',
            fontSize: '11px',
            color: '#fbbf24',
            fontFamily: "'DM Mono', monospace",
            lineHeight: '1.5',
          }}
        >
          ⚠ SUPABASE NO CONFIGURADO<br />
          <span style={{ color: '#6b6b8a', fontFamily: "'Outfit', sans-serif", fontSize: '11px' }}>
            Crea un .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: supabaseMissing ? '8px 16px 14px' : '18px 16px 14px', borderBottom: '1px solid #1e1e3a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                background: 'linear-gradient(135deg, #8b5cf6, #22d3ee)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
              }}
            >
              ◈
            </div>
            <span style={{ fontWeight: '700', fontSize: '15px', color: '#e8e8f0', letterSpacing: '-0.3px' }}>
              Ephemera
            </span>
          </div>
          <NotificationsPanel
            onOpenDm={(conversationId, otherUserId, otherAlias) => onSelectDm(conversationId, otherUserId, otherAlias)}
            onOpenGroup={(groupId, groupName) => onSelectGroup(groupId, groupName)}
            onOpenAdmin={onAdminPanel}
          />
          {user?.is_admin && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={onAdminPanel}
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '7px',
                  padding: pendingCount > 0 ? '4px 6px 4px 8px' : '4px 8px',
                  color: '#f87171',
                  fontSize: '10px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: '0.05em',
                }}
              >
                ADMIN
              </button>
              {pendingCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    minWidth: '16px',
                    height: '16px',
                    background: '#22d3ee',
                    borderRadius: '8px',
                    color: '#070711',
                    fontSize: '9px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    border: '1px solid #0a0a18',
                  }}
                >
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* User row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#14142a', borderRadius: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              background: 'rgba(139,92,246,0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: '#c4b5fd',
              fontWeight: '700',
              flexShrink: 0,
            }}
          >
            {user?.alias?.[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: '13px', color: '#9090b0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{user?.alias}
          </span>
        </div>
      </div>

      {/* User search */}
      <div style={{ padding: '10px 10px 4px' }}>
        <div style={{ position: 'relative' }}>
          <input
            value={dmSearch}
            onChange={(e) => {
              setDmSearch(e.target.value)
              if (e.target.value.trim()) searchUsers(e.target.value.trim())
              else setDmResults([])
            }}
            placeholder="Buscar usuario @alias..."
            style={inputSm}
            onFocus={(e) => (e.target.style.borderColor = '#22d3ee')}
            onBlur={(e) => (e.target.style.borderColor = '#1e1e3a')}
          />
          <span
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '11px',
              color: '#3d3d5c',
              fontFamily: "'DM Mono', monospace",
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
        </div>

        {dmResults.length > 0 && (
          <div
            style={{
              marginTop: '6px',
              border: '1px solid #1e1e3a',
              borderRadius: '10px',
              background: '#0f0f1e',
              overflow: 'hidden',
            }}
          >
            {dmResults.map((u) => (
              <button
                key={u.id}
                onClick={() => startDm(u.id, u.alias)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid #14142a',
                  color: '#e8e8f0',
                  fontSize: '13px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(34,211,238,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    minWidth: '24px',
                    background: 'rgba(34,211,238,0.12)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    color: '#67e8f9',
                    fontWeight: '700',
                  }}
                >
                  {u.alias[0]?.toUpperCase()}
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: '#c4b5fd' }}>
                  @{u.alias}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#22d3ee' }}>↗</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DMs section */}
      <div style={{ padding: '6px 16px 4px' }}>
        <span style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>
          MENSAJES DIRECTOS
        </span>
      </div>
      <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '0 8px 4px' }}>
        {dms.length === 0 && (
          <p style={{ color: '#3d3d5c', fontSize: '12px', textAlign: 'center', padding: '8px 12px', margin: 0 }}>
            Sin conversaciones privadas
          </p>
        )}
        {dms.map((d) => {
          const active = activeDmId === d.conversationId
          return (
            <button
              key={d.conversationId}
              onClick={() => onSelectDm(d.conversationId, d.otherUserId, d.otherAlias)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '7px 10px',
                background: active ? 'rgba(34,211,238,0.1)' : 'transparent',
                border: `1px solid ${active ? 'rgba(34,211,238,0.25)' : 'transparent'}`,
                borderRadius: '9px',
                cursor: 'pointer',
                marginBottom: '1px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: "'Outfit', sans-serif",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  minWidth: '28px',
                  background: active ? 'rgba(34,211,238,0.18)' : '#14142a',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: active ? '#67e8f9' : '#6b6b8a',
                  fontWeight: '700',
                }}
              >
                {d.otherAlias[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: d.unreadCount > 0 ? '600' : '400',
                    color: active ? '#e8e8f0' : d.unreadCount > 0 ? '#67e8f9' : '#9090b0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  @{d.otherAlias}
                </div>
                <div style={{ fontSize: '11px', color: onlineUsers.has(d.otherUserId) ? '#22c55e' : '#3d3d5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {onlineUsers.has(d.otherUserId) ? 'En línea' : lastSeenLabel(d.otherLastSeen)}
                </div>
              </div>
              <span
                title={onlineUsers.has(d.otherUserId) ? 'En línea' : lastSeenLabel(d.otherLastSeen)}
                style={{
                  width: '8px',
                  height: '8px',
                  minWidth: '8px',
                  borderRadius: '50%',
                  background: onlineUsers.has(d.otherUserId) ? '#22c55e' : '#3d3d5c',
                  flexShrink: 0,
                }}
              />
              {d.unreadCount > 0 && !active && (
                <div
                  style={{
                    minWidth: '18px',
                    height: '18px',
                    background: '#22d3ee',
                    borderRadius: '9px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: '700',
                    color: '#070711',
                    padding: '0 5px',
                  }}
                >
                  {d.unreadCount > 99 ? '99+' : d.unreadCount}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Action buttons */}
      <div style={{ padding: '10px 10px 0' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <ActionBtn
            active={panel === 'create'}
            color="violet"
            onClick={() => setPanel(panel === 'create' ? 'none' : 'create')}
          >
            + Crear
          </ActionBtn>
          <ActionBtn
            active={panel === 'join'}
            color="cyan"
            onClick={() => { setPanel(panel === 'join' ? 'none' : 'join'); if (panel !== 'join') loadAllGroups() }}
          >
            Unirse
          </ActionBtn>
        </div>

        {/* Create form */}
        {panel === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Nombre del grupo"
              style={inputSm}
              onFocus={(e) => (e.target.style.borderColor = '#8b5cf6')}
              onBlur={(e) => (e.target.style.borderColor = '#1e1e3a')}
              onKeyDown={(e) => e.key === 'Enter' && createGroup()}
              autoFocus
            />
            <input
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              placeholder="Descripción (opcional)"
              style={inputSm}
              onFocus={(e) => (e.target.style.borderColor = '#8b5cf6')}
              onBlur={(e) => (e.target.style.borderColor = '#1e1e3a')}
            />
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={createGroup}
                disabled={creating || !newGroupName.trim()}
                style={{
                  flex: 1, padding: '7px',
                  background: newGroupName.trim() ? '#8b5cf6' : '#2a2a50',
                  border: 'none', borderRadius: '7px',
                  color: '#fff', fontSize: '12px', fontWeight: '600',
                  cursor: newGroupName.trim() ? 'pointer' : 'default',
                  fontFamily: "'Outfit', sans-serif",
                  opacity: creating ? 0.6 : 1,
                }}
              >
                {creating ? '...' : 'Crear'}
              </button>
              <button
                onClick={() => setPanel('none')}
                style={{ padding: '7px 10px', background: 'transparent', border: '1px solid #1e1e3a', borderRadius: '7px', color: '#6b6b8a', fontSize: '12px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Join panel */}
        {panel === 'join' && (
          <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {allGroups.length === 0 && (
              <p style={{ color: '#3d3d5c', fontSize: '12px', textAlign: 'center', padding: '10px 0' }}>No hay grupos</p>
            )}
            {allGroups.map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 10px',
                  background: '#14142a', border: '1px solid #1e1e3a', borderRadius: '8px',
                }}
              >
                <span style={{ fontSize: '13px', color: '#c4b5fd', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  #{g.name}
                </span>
                {myGroupIds.has(g.id) ? (
                  <span style={{ fontSize: '10px', color: '#3d3d5c', whiteSpace: 'nowrap' }}>unido</span>
                ) : (
                  <button
                    onClick={() => joinGroup(g.id, g.name)}
                    style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: '6px', padding: '3px 9px', color: '#67e8f9', fontSize: '11px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap' }}
                  >
                    Unirse
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section label */}
      <div style={{ padding: '4px 16px 6px' }}>
        <span style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>
          MIS GRUPOS
        </span>
      </div>

      {/* Group list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {groups.length === 0 && (
          <p style={{ color: '#3d3d5c', fontSize: '12px', textAlign: 'center', padding: '20px 12px' }}>
            Crea o únete a un grupo para empezar
          </p>
        )}
        {groups.map((g) => {
          const active = activeGroupId === g.id
          return (
            <button
              key={g.id}
              onClick={() => onSelectGroup(g.id, g.name)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '9px 10px',
                background: active ? 'rgba(139,92,246,0.1)' : 'transparent',
                border: `1px solid ${active ? 'rgba(139,92,246,0.25)' : 'transparent'}`,
                borderRadius: '10px',
                cursor: 'pointer',
                marginBottom: '1px',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                fontFamily: "'Outfit', sans-serif",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  minWidth: '34px',
                  background: active ? 'rgba(139,92,246,0.2)' : '#14142a',
                  borderRadius: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: active ? '#c4b5fd' : '#6b6b8a',
                  fontWeight: '700',
                }}
              >
                {g.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: g.unreadCount > 0 ? '600' : '400',
                    color: active ? '#e8e8f0' : g.unreadCount > 0 ? '#c4b5fd' : '#9090b0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {g.name}
                </div>
                {g.description && (
                  <div style={{ fontSize: '11px', color: '#3d3d5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.description}
                  </div>
                )}
              </div>
              {g.unreadCount > 0 && !active && (
                <div
                  style={{
                    minWidth: '18px',
                    height: '18px',
                    background: '#8b5cf6',
                    borderRadius: '9px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: '700',
                    color: '#fff',
                    padding: '0 5px',
                  }}
                >
                  {g.unreadCount > 99 ? '99+' : g.unreadCount}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Logout */}
      <div style={{ padding: '8px', borderTop: '1px solid #1e1e3a' }}>
        <button
          onClick={() => {
            if (user) unsubscribePush(user.id)
            logout()
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '9px',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.18)',
            borderRadius: '9px',
            color: '#f87171',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif",
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.18)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function ActionBtn({
  children,
  active,
  color,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  color: 'violet' | 'cyan'
  onClick: () => void
}) {
  const accent = color === 'violet' ? '#8b5cf6' : '#22d3ee'
  const accentDim = color === 'violet' ? 'rgba(139,92,246,0.12)' : 'rgba(34,211,238,0.08)'
  const textOn = color === 'violet' ? '#c4b5fd' : '#67e8f9'
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px',
        background: active ? accentDim : '#14142a',
        border: `1px solid ${active ? accent : '#1e1e3a'}`,
        borderRadius: '9px',
        color: active ? textOn : '#6b6b8a',
        fontSize: '12px', fontWeight: '500',
        cursor: 'pointer',
        fontFamily: "'Outfit', sans-serif",
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

const inputSm: React.CSSProperties = {
  width: '100%',
  background: '#14142a',
  border: '1px solid #1e1e3a',
  borderRadius: '8px',
  padding: '8px 10px',
  color: '#e8e8f0',
  fontSize: '12px',
  fontFamily: "'Outfit', sans-serif",
  transition: 'border-color 0.2s',
}
