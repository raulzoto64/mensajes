import { useState, useEffect } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { addNotification } from '../lib/notifications'

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
  onAdminPanel: () => void
}

export default function GroupList({ activeGroupId, onSelectGroup, onAdminPanel }: Props) {
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

    setGroups(gs.map((g) => ({ ...g, unreadCount: unreadByGroup.get(g.id) ?? 0 })))
    setLoading(false)
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
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1e1e3a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#e8e8f0' }}>Grupos</h2>
          {user?.is_admin && (
            <button
              onClick={onAdminPanel}
              style={{
                padding: '5px 10px', background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: '7px',
                color: '#f87171', fontSize: '10px', fontWeight: '700',
                cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              }}
            >
              ADMIN
            </button>
          )}
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setPanel(panel === 'create' ? 'none' : 'create')}
            style={{
              flex: 1, padding: '8px',
              background: panel === 'create' ? 'rgba(139,92,246,0.12)' : '#14142a',
              border: `1px solid ${panel === 'create' ? '#8b5cf6' : '#1e1e3a'}`,
              borderRadius: '9px',
              color: panel === 'create' ? '#c4b5fd' : '#6b6b8a',
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
              background: panel === 'join' ? 'rgba(34,211,238,0.08)' : '#14142a',
              border: `1px solid ${panel === 'join' ? '#22d3ee' : '#1e1e3a'}`,
              borderRadius: '9px',
              color: panel === 'join' ? '#67e8f9' : '#6b6b8a',
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
              onFocus={(e) => (e.target.style.borderColor = '#8b5cf6')}
              onBlur={(e) => (e.target.style.borderColor = '#1e1e3a')}
              onKeyDown={(e) => e.key === 'Enter' && createGroup()}
              autoFocus
            />
            <input
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              placeholder="Descripción (opcional)"
              style={inputStyle}
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
          <div style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {allGroups.length === 0 && (
              <p style={{ color: '#3d3d5c', fontSize: '12px', textAlign: 'center', padding: '10px 0' }}>No hay grupos</p>
            )}
            {allGroups.map((g) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: '#14142a', border: '1px solid #1e1e3a', borderRadius: '8px' }}>
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

      {/* Group list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {!supabaseConfigured && (
          <div style={{ margin: '8px', padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', fontSize: '11px', color: '#fbbf24', fontFamily: "'DM Mono', monospace", lineHeight: '1.5' }}>
            ⚠ SUPABASE NO CONFIGURADO
          </div>
        )}
        {loading && groups.length === 0 && (
          <p style={{ color: '#3d3d5c', fontSize: '12px', textAlign: 'center', padding: '40px 20px' }}>Cargando...</p>
        )}
        {!loading && groups.length === 0 && (
          <p style={{ color: '#3d3d5c', fontSize: '12px', textAlign: 'center', padding: '40px 20px' }}>
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
                width: '100%', textAlign: 'left',
                padding: '10px 12px',
                background: active ? 'rgba(139,92,246,0.1)' : 'transparent',
                border: `1px solid ${active ? 'rgba(139,92,246,0.25)' : 'transparent'}`,
                borderRadius: '10px', cursor: 'pointer', marginBottom: '2px',
                display: 'flex', alignItems: 'center', gap: '10px',
                fontFamily: "'Outfit', sans-serif", transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{
                width: '40px', height: '40px', minWidth: '40px',
                background: active ? 'rgba(139,92,246,0.2)' : '#14142a',
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', color: active ? '#c4b5fd' : '#6b6b8a', fontWeight: '700',
              }}>
                {g.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{
                  fontSize: '14px', fontWeight: g.unreadCount > 0 ? '600' : '400',
                  color: active ? '#e8e8f0' : g.unreadCount > 0 ? '#c4b5fd' : '#9090b0',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {g.name}
                </div>
                {g.description && (
                  <div style={{ fontSize: '11px', color: '#3d3d5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.description}
                  </div>
                )}
              </div>
              {g.unreadCount > 0 && !active && (
                <div style={{
                  minWidth: '20px', height: '20px', background: '#8b5cf6', borderRadius: '10px',
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
  background: '#14142a',
  border: '1px solid #1e1e3a',
  borderRadius: '8px',
  padding: '8px 10px',
  color: '#e8e8f0',
  fontSize: '12px',
  fontFamily: "'Outfit', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
}
