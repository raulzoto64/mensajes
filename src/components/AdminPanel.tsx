import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type User = {
  id: string
  alias: string
  is_admin: boolean
  created_at: string
}

type Props = {
  onClose: () => void
}

type Tab = 'actions' | 'users'

export default function AdminPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('actions')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    if (tab === 'users') loadUsers()
  }, [tab])

  function addLog(msg: string) {
    setLog((l) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l].slice(0, 20))
  }

  async function loadUsers() {
    setUsersLoading(true)
    const { data } = await supabase.from('users').select('id, alias, is_admin, created_at').order('created_at', { ascending: false })
    if (data) setUsers(data as User[])
    setUsersLoading(false)
  }

  async function toggleAdmin(userId: string, current: boolean) {
    await supabase.from('users').update({ is_admin: !current }).eq('id', userId)
    addLog(`${current ? 'Admin removido' : 'Admin asignado'} a usuario ${userId.slice(0, 8)}`)
    loadUsers()
  }

  async function deleteUser(userId: string, alias: string) {
    await supabase.from('users').delete().eq('id', userId)
    addLog(`Usuario @${alias} eliminado`)
    loadUsers()
  }

  // Bulk actions
  async function run(action: string, fn: () => PromiseLike<{ count: number | null; error: { message: string } | null }>) {
    setLoading(true)
    const { error, count } = await fn()
    if (error) addLog(`Error en ${action}: ${error.message}`)
    else addLog(`${action}: ${count ?? 0} registros afectados`)
    setConfirming(null)
    setLoading(false)
  }

  const bulkActions: { id: string; label: string; desc: string; color: string; fn: () => PromiseLike<{ count: number | null; error: { message: string } | null }> }[] = [
    {
      id: 'messages',
      label: 'Eliminar todos los mensajes',
      desc: 'Borra todos los mensajes de todos los grupos',
      color: '#f87171',
      fn: () =>
        supabase.from('messages').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000'),
    },
    {
      id: 'groups',
      label: 'Eliminar todos los grupos',
      desc: 'Borra grupos y sus mensajes en cascada',
      color: '#fb923c',
      fn: () =>
        supabase.from('groups').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000'),
    },
    {
      id: 'views',
      label: 'Resetear vistas de mensajes',
      desc: 'Los mensajes volverán a aparecer como no vistos',
      color: '#fbbf24',
      fn: () =>
        supabase.from('message_views').delete({ count: 'exact' }).neq('message_id', '00000000-0000-0000-0000-000000000000'),
    },
    {
      id: 'gifs',
      label: 'Eliminar GIFs personalizados',
      desc: 'Elimina todos los GIFs subidos por los usuarios',
      color: '#a78bfa',
      fn: () =>
        supabase.from('custom_gifs').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000'),
    },
  ]

  const filteredUsers = users.filter((u) =>
    u.alias.toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(7,7,17,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        backdropFilter: 'blur(6px)',
        fontFamily: "'Outfit', sans-serif",
        padding: '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#0f0f1e',
          border: '1px solid #2a2a50',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #1e1e3a', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#e8e8f0' }}>
                Panel de Administrador
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace" }}>
                ACCESO CON PRIVILEGIOS COMPLETOS
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ background: '#14142a', border: '1px solid #1e1e3a', borderRadius: '8px', padding: '6px 10px', color: '#6b6b8a', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', background: '#14142a', borderRadius: '9px', padding: '3px', gap: '2px' }}>
            {(['actions', 'users'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: '7px',
                  borderRadius: '7px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'all 0.15s',
                  background: tab === t ? (t === 'users' ? '#8b5cf6' : 'rgba(239,68,68,0.15)') : 'transparent',
                  color: tab === t ? (t === 'users' ? '#fff' : '#f87171') : '#6b6b8a',
                }}
              >
                {t === 'actions' ? '⚡ Acciones' : '👤 Usuarios'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {tab === 'actions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bulkActions.map((action) => (
                <div
                  key={action.id}
                  style={{
                    background: '#14142a',
                    border: `1px solid ${confirming === action.id ? action.color + '30' : '#1e1e3a'}`,
                    borderRadius: '12px',
                    padding: '13px 15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#e8e8f0', marginBottom: '2px' }}>
                      {action.label}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b6b8a' }}>{action.desc}</div>
                  </div>

                  {confirming === action.id ? (
                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                      <button
                        onClick={() => run(action.label, action.fn)}
                        disabled={loading}
                        style={{
                          padding: '5px 13px',
                          background: action.color,
                          border: 'none',
                          borderRadius: '7px',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: loading ? 'default' : 'pointer',
                          fontFamily: "'Outfit', sans-serif",
                          opacity: loading ? 0.6 : 1,
                        }}
                      >
                        {loading ? '...' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        style={{ padding: '5px 8px', background: 'transparent', border: '1px solid #1e1e3a', borderRadius: '7px', color: '#6b6b8a', fontSize: '12px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirming(action.id)}
                      style={{
                        padding: '5px 13px',
                        background: `${action.color}12`,
                        border: `1px solid ${action.color}25`,
                        borderRadius: '7px',
                        color: action.color,
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontFamily: "'Outfit', sans-serif",
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Ejecutar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por alias..."
                style={{
                  background: '#14142a',
                  border: '1px solid #1e1e3a',
                  borderRadius: '9px',
                  padding: '9px 12px',
                  color: '#e8e8f0',
                  fontSize: '13px',
                  fontFamily: "'Outfit', sans-serif",
                  width: '100%',
                }}
              />
              {usersLoading ? (
                <p style={{ color: '#3d3d5c', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Cargando...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace", marginBottom: '4px' }}>
                    {filteredUsers.length} USUARIO{filteredUsers.length !== 1 ? 'S' : ''}
                  </div>
                  {filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: '#14142a',
                        border: '1px solid #1e1e3a',
                        borderRadius: '10px',
                      }}
                    >
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          background: u.is_admin ? 'rgba(239,68,68,0.15)' : '#1e1e3a',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: u.is_admin ? '#f87171' : '#8b5cf6',
                          fontWeight: '700',
                          flexShrink: 0,
                        }}
                      >
                        {u.alias[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', color: '#e8e8f0', fontWeight: '500' }}>@{u.alias}</span>
                          {u.is_admin && (
                            <span style={{ fontSize: '9px', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '1px 5px', fontFamily: "'DM Mono', monospace" }}>
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace" }}>
                          {new Date(u.created_at).toLocaleDateString('es')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                        <button
                          onClick={() => toggleAdmin(u.id, u.is_admin)}
                          title={u.is_admin ? 'Quitar admin' : 'Hacer admin'}
                          style={{
                            padding: '4px 9px',
                            background: u.is_admin ? 'rgba(239,68,68,0.08)' : 'rgba(139,92,246,0.08)',
                            border: `1px solid ${u.is_admin ? 'rgba(239,68,68,0.2)' : 'rgba(139,92,246,0.2)'}`,
                            borderRadius: '7px',
                            color: u.is_admin ? '#f87171' : '#c4b5fd',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontFamily: "'Outfit', sans-serif",
                          }}
                        >
                          {u.is_admin ? 'Revocar' : 'Admin'}
                        </button>
                        <button
                          onClick={() => deleteUser(u.id, u.alias)}
                          style={{
                            padding: '4px 8px',
                            background: 'transparent',
                            border: '1px solid rgba(239,68,68,0.15)',
                            borderRadius: '7px',
                            color: '#f87171',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontFamily: "'Outfit', sans-serif",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Activity log */}
        {log.length > 0 && (
          <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #1e1e3a', flexShrink: 0 }}>
            <div style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace", marginBottom: '6px' }}>
              LOG
            </div>
            <div style={{ maxHeight: '80px', overflowY: 'auto' }}>
              {log.map((entry, i) => (
                <div key={i} style={{ fontSize: '11px', color: '#6b6b8a', fontFamily: "'DM Mono', monospace", marginBottom: '2px' }}>
                  {entry}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
