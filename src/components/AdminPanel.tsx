import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type User = {
  id: string
  alias: string
  is_admin: boolean
  is_super_admin: boolean
  is_approved: boolean
  created_at: string
}

type Props = {
  onClose: () => void
  initialTab?: Tab
}

type Tab = 'actions' | 'approvals' | 'users' | 'locations'

const APPROVAL_PLACEHOLDER = '00000000-0000-0000-0000-000000000000'

export default function AdminPanel({ onClose, initialTab = 'actions' }: Props) {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [locations, setLocations] = useState<any[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)

  useEffect(() => {
    if (tab === 'users' || tab === 'approvals') loadUsers()
    if (tab === 'locations' && user?.is_super_admin) loadLocations()
  }, [tab, user?.is_super_admin])

  // Refresco en vivo del panel cuando se registra un usuario nuevo
  useEffect(() => {
    const channel = supabase
      .channel('admin-pending')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, loadUsers)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function addLog(msg: string) {
    setLog((l) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l].slice(0, 20))
  }

  async function loadUsers() {
    setUsersLoading(true)
    const { data } = await supabase.from('users').select('id, alias, is_admin, is_super_admin, is_approved, created_at').order('created_at', { ascending: false })
    if (data) setUsers(data as User[])
    setUsersLoading(false)
  }

  async function approveUser(userId: string, alias: string) {
    const { error } = await supabase.from('users').update({ is_approved: true }).eq('id', userId)
    if (error) addLog(`Error aprobando @${alias}: ${error.message}`)
    else {
      addLog(`Usuario @${alias} aprobado`)
      loadUsers()
    }
  }

  async function toggleAdmin(userId: string, current: boolean) {
    await supabase.from('users').update({ is_admin: !current }).eq('id', userId)
    addLog(`${current ? 'Admin removido' : 'Admin asignado'} a usuario ${userId.slice(0, 8)}`)
    loadUsers()
  }

  async function toggleSuperAdmin(userId: string, current: boolean) {
    // El super admin también es admin normal, así puede abrir el panel.
    await supabase.from('users').update({ is_super_admin: !current, is_admin: true }).eq('id', userId)
    addLog(`${current ? 'Super admin removido' : 'Super admin asignado'} a usuario ${userId.slice(0, 8)}`)
    loadUsers()
  }

  async function deleteUser(userId: string, alias: string) {
    await supabase.from('users').delete().eq('id', userId)
    addLog(`Usuario @${alias} eliminado`)
    loadUsers()
  }

  async function loadLocations() {
    setLocationsLoading(true)
    const { data: logs } = await supabase
      .from('device_logs')
      .select('user_id, device_type, browser, os, push_permission, has_sub_db, mic_permission, cam_permission, screen_permission, lat, lng, created_at')
      .order('created_at', { ascending: false })
      .limit(400)
    // Quedamos con el registro más reciente de cada usuario
    const byUser = new Map<string, any>()
    for (const l of logs ?? []) {
      if (!byUser.has(l.user_id)) byUser.set(l.user_id, l)
    }
    const ids = [...byUser.keys()]
    const { data: us } = ids.length
      ? await supabase.from('users').select('id, alias').in('id', ids)
      : { data: [] }
    const aliasMap = new Map((us ?? []).map((u: any) => [u.id, u.alias]))
    const rows = [...byUser.values()].map((l) => ({ ...l, alias: aliasMap.get(l.user_id) ?? 'desconocido' }))
    setLocations(rows)
    setLocationsLoading(false)
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
    {
      id: 'conversations',
      label: 'Eliminar TODAS las conversaciones',
      desc: 'Borra mensajes, chats privados y grupos de TODO el sistema (acción irreversible)',
      color: '#f87171',
      fn: async () => {
        const a = await supabase.from('messages').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('direct_messages').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('direct_conversations').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000')
        await supabase.from('groups').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000')
        return { count: a.count, error: a.error }
      },
    },
  ]

  const filteredUsers = users.filter((u) =>
    u.alias.toLowerCase().includes(userSearch.toLowerCase())
  )

  const pendingUsers = filteredUsers.filter((u) => !u.is_approved)

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
            {(['actions', 'approvals', 'users', 'locations'] as const).map((t) => {
              if (t === 'locations' && !user?.is_super_admin) return null
              const active = tab === t
              const color = t === 'locations' ? '#22c55e' : t === 'users' ? '#8b5cf6' : t === 'approvals' ? '#22d3ee' : '#f87171'
              const label =
                t === 'actions' ? '⚡ Acciones'
                : t === 'approvals' ? `🛃 Aprobaciones (${pendingUsers.length})`
                : t === 'users' ? '👤 Usuarios'
                : '📍 Ubicaciones'
              return (
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
                    background: active ? color : 'transparent',
                    color: active ? (t === 'approvals' ? '#0a0a18' : '#fff') : '#6b6b8a',
                  }}
                >
                  {label}
                </button>
              )
            })}
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

          {tab === 'approvals' && (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#6b6b8a' }}>
                Usuarios que se registraron y esperan tu permiso para entrar.
              </p>
              {users.length === 0 && !usersLoading ? (
                <button
                  onClick={() => { setTab('approvals'); loadUsers() }}
                  style={loadUsersBtn}
                >
                  Cargar solicitudes
                </button>
              ) : pendingUsers.length === 0 ? (
                <p style={{ color: '#3d3d5c', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                  No hay solicitudes pendientes
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pendingUsers.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: '#14142a',
                        border: '1px solid rgba(34,211,238,0.3)',
                        borderRadius: '10px',
                      }}
                    >
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          background: 'rgba(34,211,238,0.15)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: '#67e8f9',
                          fontWeight: '700',
                          flexShrink: 0,
                        }}
                      >
                        {u.alias[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <span style={{ fontSize: '13px', color: '#e8e8f0', fontWeight: '500' }}>@{u.alias}</span>
                        <div style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace" }}>
                          {new Date(u.created_at).toLocaleString('es')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                        <button
                          onClick={() => approveUser(u.id, u.alias)}
                          style={{
                            padding: '5px 12px',
                            background: 'rgba(34,211,238,0.15)',
                            border: '1px solid rgba(34,211,238,0.4)',
                            borderRadius: '7px',
                            color: '#22d3ee',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontFamily: "'Outfit', sans-serif",
                          }}
                        >
                          ✅ Aprobar
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
                        border: `1px solid ${u.is_approved ? '#1e1e3a' : 'rgba(34,211,238,0.35)'}`,
                        borderRadius: '10px',
                      }}
                    >
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          background: u.is_admin ? 'rgba(239,68,68,0.15)' : u.is_approved ? '#1e1e3a' : 'rgba(34,211,238,0.15)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: u.is_admin ? '#f87171' : u.is_approved ? '#8b5cf6' : '#67e8f9',
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
                          {u.is_super_admin && (
                            <span style={{ fontSize: '9px', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '4px', padding: '1px 5px', fontFamily: "'DM Mono', monospace" }}>
                              SUPER
                            </span>
                          )}
                          {!u.is_approved && (
                            <span style={{ fontSize: '9px', color: '#22d3ee', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: '4px', padding: '1px 5px', fontFamily: "'DM Mono', monospace" }}>
                              PENDIENTE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace" }}>
                          {new Date(u.created_at).toLocaleDateString('es')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                        {!u.is_approved && (
                          <button
                            onClick={() => approveUser(u.id, u.alias)}
                            style={{
                              padding: '4px 9px',
                              background: 'rgba(34,211,238,0.15)',
                              border: '1px solid rgba(34,211,238,0.4)',
                              borderRadius: '7px',
                              color: '#22d3ee',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              fontFamily: "'Outfit', sans-serif",
                            }}
                          >
                            ✅ Aprobar
                          </button>
                        )}
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
                        {user?.is_super_admin && (
                          <button
                            onClick={() => toggleSuperAdmin(u.id, u.is_super_admin)}
                            title={u.is_super_admin ? 'Quitar super admin' : 'Hacer super admin'}
                            style={{
                              padding: '4px 9px',
                              background: u.is_super_admin ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.08)',
                              border: `1px solid ${u.is_super_admin ? 'rgba(251,191,36,0.4)' : 'rgba(251,191,36,0.2)'}`,
                              borderRadius: '7px',
                              color: '#fbbf24',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontFamily: "'Outfit', sans-serif",
                            }}
                          >
                            {u.is_super_admin ? 'Quitar super' : 'Super'}
                          </button>
                        )}
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

          {tab === 'locations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#6b6b8a' }}>
                Última ubicación registrada de cada usuario al configurar notificaciones.
              </p>
              {locationsLoading ? (
                <p style={{ color: '#3d3d5c', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Cargando...</p>
              ) : locations.length === 0 ? (
                <p style={{ color: '#3d3d5c', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                  Sin registros de ubicación
                </p>
              ) : (
                locations.map((l) => (
                  <div
                    key={l.user_id}
                    style={{
                      background: '#14142a',
                      border: '1px solid #1e1e3a',
                      borderRadius: '10px',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#e8e8f0' }}>@{l.alias}</span>
                      <span style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace" }}>
                        {new Date(l.created_at).toLocaleString('es')}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b6b8a', marginTop: '2px' }}>
                      {l.device_type} · {l.browser} · {l.os}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9090b0', marginTop: '2px' }}>
                      Push: {l.push_permission === 'granted' ? '✅' : '⛔'} · Sub BD: {l.has_sub_db ? '✅' : '⛔'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9090b0', marginTop: '2px' }}>
                      🎤 {l.mic_permission ? '✅' : '⛔'} · 📷 {l.cam_permission ? '✅' : '⛔'} · 🖥️ {l.screen_permission ? '✅' : '⛔'}
                    </div>
                    {l.lat != null && l.lng != null ? (
                      <a
                        href={`https://maps.google.com/?q=${l.lat},${l.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '11px', color: '#22c55e', marginTop: '2px', display: 'inline-block', textDecoration: 'none' }}
                      >
                        📍 {Number(l.lat).toFixed(4)}, {Number(l.lng).toFixed(4)}
                      </a>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#3d3d5c', marginTop: '2px' }}>sin ubicación</div>
                    )}
                  </div>
                ))
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

const loadUsersBtn: React.CSSProperties = {
  width: '100%',
  padding: '9px',
  background: 'rgba(34,211,238,0.1)',
  border: '1px solid rgba(34,211,238,0.3)',
  borderRadius: '9px',
  color: '#67e8f9',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
  fontFamily: "'Outfit', sans-serif",
}
