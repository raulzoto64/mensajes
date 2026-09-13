import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOnlineUsers } from '../lib/realtime'

type Member = {
  user_id: string
  alias: string
  is_admin: boolean
  joined_at: string
}

type Props = {
  groupId: string
  onClose: () => void
}

export default function GroupMembersPanel({ groupId, onClose }: Props) {
  const { user } = useAuth()
  const onlineUsers = useOnlineUsers(user?.id ?? null)
  const [members, setMembers] = useState<Member[]>([])
  const [groupName, setGroupName] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [inviteSearch, setInviteSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; alias: string }[]>([])
  const [adding, setAdding] = useState(false)
  const [createdBy, setCreatedBy] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [groupId])

  async function load() {
    setLoading(true)
    const [{ data: grp }, { data: mems }] = await Promise.all([
      supabase.from('groups').select('name, created_by').eq('id', groupId).maybeSingle(),
      supabase
        .from('group_members')
        .select('user_id, joined_at, users(alias, is_admin)')
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true }),
    ])

    if (grp) {
      setGroupName(grp.name)
      setCreatedBy((grp as any).created_by ?? null)
    }
    if (mems) {
      setMembers(
        mems.map((m: any) => ({
          user_id: m.user_id,
          alias: m.users?.alias ?? 'usuario',
          is_admin: m.users?.is_admin ?? false,
          joined_at: m.joined_at,
        }))
      )
    }
    setLoading(false)
  }

  async function searchUsers(q: string) {
    if (!q.trim()) { setSearchResults([]); return }
    const { data } = await supabase
      .from('users')
      .select('id, alias')
      .ilike('alias', `%${q.trim()}%`)
      .limit(6)
    const memberIds = new Set(members.map((m) => m.user_id))
    setSearchResults((data ?? []).filter((u: any) => !memberIds.has(u.id)))
  }

  useEffect(() => {
    const t = setTimeout(() => searchUsers(inviteSearch), 300)
    return () => clearTimeout(t)
  }, [inviteSearch, members])

  async function addMember(userId: string) {
    setAdding(true)
    await supabase.from('group_members').upsert({ group_id: groupId, user_id: userId })
    setInviteSearch('')
    setSearchResults([])
    await load()
    setAdding(false)
  }

  async function removeMember(userId: string) {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId)
    load()
  }

  async function leaveGroup() {
    if (!user) return
    setLeaving(true)
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id)
    setLeaving(false)
    onClose()
    window.location.reload()
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(7,7,17,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        backdropFilter: 'blur(6px)',
        padding: '24px',
        fontFamily: "'Outfit', sans-serif",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #d1d7db',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '440px',
          padding: '28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#111b21' }}>
              #{groupName}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#adb5bd', fontFamily: "'DM Mono', monospace" }}>
              {members.length} MIEMBRO{members.length !== 1 ? 'S' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#f0f2f5', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 10px', color: '#8696a0', cursor: 'pointer', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>

        {/* Invite search */}
        {user?.id === createdBy && (
          <div style={{ position: 'relative' }}>
          <input
            value={inviteSearch}
            onChange={(e) => setInviteSearch(e.target.value)}
            placeholder="Invitar usuario por alias..."
            style={{
              width: '100%',
              background: '#f0f2f5',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#111b21',
              fontSize: '13px',
              fontFamily: "'Outfit', sans-serif",
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#00a884')}
            onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
          />
          {searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                background: '#f0f2f5',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                overflow: 'hidden',
                zIndex: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            >
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => addMember(u.id)}
                  disabled={adding}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #1a1a35',
                    cursor: adding ? 'default' : 'pointer',
                    textAlign: 'left',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,168,132,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      background: '#e5e7eb',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      color: '#00a884',
                      fontWeight: '600',
                      flexShrink: 0,
                    }}
                  >
                    {u.alias[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: '13px', color: '#00a884' }}>@{u.alias}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#00a884' }}>+ Añadir</span>
                </button>
              ))}
            </div>
          )}
          </div>
        )}

        {/* Member list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {loading ? (
            <p style={{ color: '#adb5bd', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Cargando...</p>
          ) : (
            members.map((m) => (
              <div
                key={m.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: m.user_id === user?.id ? 'rgba(0,168,132,0.06)' : '#f0f2f5',
                  border: `1px solid ${m.user_id === user?.id ? 'rgba(0,168,132,0.12)' : '#e5e7eb'}`,
                  borderRadius: '10px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    background: '#e5e7eb',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#00a884',
                    fontWeight: '600',
                    flexShrink: 0,
                  }}
                >
                  {m.alias[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px', color: '#111b21', fontWeight: '500' }}>@{m.alias}</span>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: onlineUsers.has(m.user_id) ? '#25d366' : '#adb5bd', flexShrink: 0 }} />
                    {m.is_admin && (
                      <span style={{ fontSize: '10px', color: '#ea4335', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(234,67,53,0.2)', borderRadius: '4px', padding: '1px 5px', fontFamily: "'DM Mono', monospace" }}>
                        ADMIN
                      </span>
                    )}
                    {m.user_id === user?.id && (
                      <span style={{ fontSize: '10px', color: '#00a884', fontFamily: "'DM Mono', monospace" }}>TÚ</span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#adb5bd', fontFamily: "'DM Mono', monospace" }}>
                    DESDE {formatDate(m.joined_at).toUpperCase()}
                  </div>
                </div>
                {user?.id === createdBy && m.user_id !== user.id && (
                  <button
                    onClick={() => removeMember(m.user_id)}
                    style={{
                      background: 'rgba(234,67,53,0.08)',
                      border: '1px solid rgba(239,68,68,0.15)',
                      borderRadius: '7px',
                      padding: '4px 8px',
                      color: '#ea4335',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    Expulsar
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Leave group */}
        <button
          onClick={leaveGroup}
          disabled={leaving}
          style={{
            padding: '11px',
            background: 'transparent',
            border: '1px solid rgba(234,67,53,0.25)',
            borderRadius: '10px',
            color: '#ea4335',
            fontSize: '13px',
            fontWeight: '500',
            cursor: leaving ? 'default' : 'pointer',
            fontFamily: "'Outfit', sans-serif",
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(234,67,53,0.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {leaving ? 'Saliendo...' : '↩ Salir del grupo'}
        </button>
      </div>
    </div>
  )
}
