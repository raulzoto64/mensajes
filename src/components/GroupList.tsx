import { useState, useEffect } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'


type Group = {
  id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  unreadCount: number
}

type Props = {
  activeGroupId: string | null
  onSelectGroup: (id: string, name: string) => void
}

export default function GroupList({ activeGroupId, onSelectGroup }: Props) {
  const { user } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [allGroups, setAllGroups] = useState<{ id: string; name: string; description: string | null }[]>([])
  const [panel, setPanel] = useState<'none' | 'create' | 'join'>('none')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadMyGroups()
    const channel = supabase
      .channel('grouplist-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, loadMyGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, loadMyGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadMyGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_views' }, loadMyGroups)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  async function loadMyGroups() {
    if (!user) return

    const CACHE_KEY = 'ephemera_cache_groups'
    const CACHE_TTL = 60 * 60 * 1000
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < CACHE_TTL) {
        setGroups(data)
        setLoading(false)
      }
    }

    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, description, created_by, created_at)')
      .eq('user_id', user.id)

    if (!memberships) { setLoading(false); return }
    const gs = memberships.map((r: any) => r.groups).filter(Boolean) as Omit<Group, 'unreadCount'>[]

    const groupIds = gs.map((g) => g.id)
    if (!groupIds.length) { setGroups([]); setLoading(false); return }

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
      if (m.sender_id !== user.id && !viewedIds.has(m.id)) {
        unreadByGroup.set(m.group_id, (unreadByGroup.get(m.group_id) ?? 0) + 1)
      }
    }

    const finalGroups = gs.map((g) => ({ ...g, unreadCount: unreadByGroup.get(g.id) ?? 0 }))
    setGroups(finalGroups)
    setLoading(false)
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: finalGroups, timestamp: Date.now() }))
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          {/* Header text removed */}
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setPanel(panel === 'create' ? 'none' : 'create')}
            style={{
              flex: 1, padding: '8px',
              background: panel === 'create' ? 'rgba(0,168,132,0.1)' : '#f0f2f5',
              border: `1px solid ${panel === 'create' ? '#00a884' : '#e5e7eb'}`,
              borderRadius: '9px',
              color: panel === 'create' ? '#00a884' : '#8696a0',
              fontSize: '12px', fontWeight: '500', cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            + Crear
          </button>
          <button
            onClick={() => { setPanel(panel === 'join' ? 'none' : 'join'); if (panel !== 'join') loadAllGroups() }}
            style={{
              flex: 1, padding: '8px',
              background: panel === 'join' ? 'rgba(0,136,204,0.08)' : '#f0f2f5',
              border: `1px solid ${panel === 'join' ? '#0088cc' : '#e5e7eb'}`,
              borderRadius: '9px',
              color: panel === 'join' ? '#0088cc' : '#8696a0',
              fontSize: '12px', fontWeight: '500', cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Unirse
          </button>
        </div>

        {/* Create form */}
        {panel === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Nombre del grupo"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = '#00a884')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
              onKeyDown={(e) => e.key === 'Enter' && createGroup()}
              autoFocus
            />
            <input
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              placeholder="Descripción (opcional)"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = '#00a884')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
            />
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={createGroup}
                disabled={creating || !newGroupName.trim()}
                style={{
                  flex: 1, padding: '7px',
                  background: newGroupName.trim() ? '#00a884' : '#d1d7db',
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
                style={{ padding: '7px 10px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: '7px', color: '#8696a0', fontSize: '12px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Join panel */}
        {panel === 'join' && (
          <div style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {allGroups.length === 0 && (
              <p style={{ color: '#adb5bd', fontSize: '12px', textAlign: 'center', padding: '10px 0' }}>No hay grupos</p>
            )}
            {allGroups.map((g) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: '#f0f2f5', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px', color: '#00a884', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  #{g.name}
                </span>
                {myGroupIds.has(g.id) ? (
                  <span style={{ fontSize: '10px', color: '#adb5bd', whiteSpace: 'nowrap' }}>unido</span>
                ) : (
                  <button
                    onClick={() => joinGroup(g.id, g.name)}
                    style={{ background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: '6px', padding: '3px 9px', color: '#0088cc', fontSize: '11px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap' }}
                  >
                    Unirse
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Group list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {!supabaseConfigured && (
          <div style={{ margin: '8px', padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', fontSize: '11px', color: '#fbbf24', fontFamily: "'DM Mono', monospace", lineHeight: '1.5' }}>
            ⚠ SUPABASE NO CONFIGURADO
          </div>
        )}
        {loading && groups.length === 0 && (
          <p style={{ color: '#adb5bd', fontSize: '12px', textAlign: 'center', padding: '40px 20px' }}>Cargando...</p>
        )}
        {!loading && groups.length === 0 && (
          <p style={{ color: '#adb5bd', fontSize: '12px', textAlign: 'center', padding: '40px 20px' }}>
            Crea o únete a un grupo para empezar
          </p>
        )}
        {groups.map((g) => {
          const active = activeGroupId === g.id
          return (
            <button
              key={g.id}
              onClick={() => onSelectGroup(g.id, g.name)}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(0,168,132,0.2)' } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = '#f8f9fa'; e.currentTarget.style.borderColor = '#e9ecef' } }}
              onMouseDown={(e) => { if (!active) e.currentTarget.style.background = 'rgba(0,168,132,0.06)' }}
              onMouseUp={(e) => { if (!active) { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(0,168,132,0.2)' } }}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 12px',
                background: active ? 'rgba(0,168,132,0.08)' : '#f8f9fa',
                border: `1px solid ${active ? 'rgba(0,168,132,0.25)' : '#e9ecef'}`,
                borderRadius: '12px', cursor: 'pointer', marginBottom: '6px',
                display: 'flex', alignItems: 'center', gap: '10px',
                fontFamily: "'Outfit', sans-serif",
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <div style={{
                width: '40px', height: '40px', minWidth: '40px',
                background: active ? '#00a884' : '#f0f2f5',
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', color: active ? '#fff' : '#8696a0', fontWeight: '700',
              }}>
                {g.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{
                  fontSize: '14px', fontWeight: g.unreadCount > 0 ? '600' : '400',
                  color: active ? '#111b21' : g.unreadCount > 0 ? '#00a884' : '#667781',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {g.name}
                </div>
                {g.description && (
                  <div style={{ fontSize: '11px', color: '#adb5bd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.description}
                  </div>
                )}
              </div>
              {g.unreadCount > 0 && !active && (
                <div style={{
                  minWidth: '20px', height: '20px', background: '#00a884', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '700', color: '#fff', padding: '0 5px',
                }}>
                  {g.unreadCount > 99 ? '99+' : g.unreadCount}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#f0f2f5',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '8px 10px',
  color: '#111b21',
  fontSize: '12px',
  fontFamily: "'Outfit', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
}
