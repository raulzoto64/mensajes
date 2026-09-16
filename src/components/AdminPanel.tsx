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
  const [liveLocs, setLiveLocs] = useState<any[]>([])
  const [regLocs, setRegLocs] = useState<any[]>([])

  useEffect(() => {
    if (tab === 'users' || tab === 'approvals') loadUsers()
    if (tab === 'locations' && user?.is_super_admin) {
      loadUsers()
      loadLocations()
      loadLiveLocs()
      loadRegLocs()
      const t = setInterval(loadLiveLocs, 10000)
      return () => clearInterval(t)
    }
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
    // Todas las ubicaciones guardadas (cada estancia >1h es una fila nueva).
    const { data: locs } = await supabase
      .from('user_locations')
      .select('id, user_id, lat, lng, accuracy, is_initial, place_type, address, manzana, lote, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    // Permisos (mic/cam/pantalla) y dispositivo desde device_logs
    const { data: logs } = await supabase
      .from('device_logs')
      .select('user_id, mic_permission, cam_permission, screen_permission, device_type')
      .order('created_at', { ascending: false })
      .limit(500)
    const permMap = new Map<string, any>()
    for (const l of logs ?? []) {
      if (!permMap.has(l.user_id)) permMap.set(l.user_id, l)
    }
    const ids = [...new Set((locs ?? []).map((l: any) => l.user_id))]
    const { data: us } = ids.length
      ? await supabase.from('users').select('id, alias').in('id', ids)
      : { data: [] }
    const aliasMap = new Map((us ?? []).map((u: any) => [u.id, u.alias]))
    const rows = (locs ?? [])
      .filter((l: any) => !(typeof l.accuracy === 'number' && l.accuracy > 1000))
      .map((l: any) => {
      const perm = permMap.get(l.user_id) ?? {}
      return {
        ...l,
        alias: aliasMap.get(l.user_id) ?? 'desconocido',
        mic_permission: perm.mic_permission,
        cam_permission: perm.cam_permission,
        screen_permission: perm.screen_permission,
        device_type: perm.device_type || 'Desconocido',
      }
    })
    setLocations(rows)
    setLocationsLoading(false)
  }

  async function loadLiveLocs() {
    const { data } = await supabase
      .from('user_live')
      .select('user_id, lat, lng, accuracy, at')
    if (data) setLiveLocs(data as any[])
  }

  async function loadRegLocs() {
    const { data } = await supabase
      .from('user_setup')
      .select('user_id, lat, lng')
    if (data) setRegLocs(data as any[])
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
      color: '#ea4335',
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
      color: '#ea4335',
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
  const approvedUsers = filteredUsers.filter((u) => u.is_approved)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#f0f2f5',
        fontFamily: "'Outfit', sans-serif",
        zIndex: 150,
      }}
    >
      <style>{`
        @media (max-width: 767px) {
          .admin-desktop-sidebar { display: none !important; }
          .admin-mobile-nav { display: flex !important; }
        }
        @media (min-width: 768px) {
          .admin-mobile-nav { display: none !important; }
        }
      `}</style>
        {/* Header */}
        <div style={{ padding: 'max(env(safe-area-inset-top, 0px), 8px) 16px 14px 16px', borderBottom: '1px solid #e5e7eb', background: '#ffffff', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{ background: '#f0f2f5', border: '1px solid #e5e7eb', color: '#8696a0', cursor: 'pointer', fontSize: '16px', padding: '4px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', fontFamily: "'Outfit', sans-serif", transition: 'all 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#111b21' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f0f2f5'; e.currentTarget.style.color = '#8696a0' }}
          >
            ←
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#111b21' }}>
              Panel de Administrador
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#adb5bd', fontFamily: "'DM Mono', monospace" }}>
              PRIVILEGIOS COMPLETOS
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Desktop sidebar nav */}
          <div className="admin-desktop-sidebar" style={{
            width: '220px', flexShrink: 0, background: '#ffffff', borderRight: '1px solid #e5e7eb',
            display: 'flex', flexDirection: 'column', padding: '12px 8px',
            fontFamily: "'Outfit', sans-serif",
          }}>
            {([
              { id: 'actions' as Tab, icon: '⚡', label: 'Acciones', color: '#ea4335' },
              { id: 'approvals' as Tab, icon: '🛃', label: 'Aprobaciones', color: '#0088cc', badge: pendingUsers.length },
              { id: 'users' as Tab, icon: '👤', label: 'Usuarios', color: '#00a884' },
              ...(user?.is_super_admin ? [{ id: 'locations' as Tab, icon: '📍', label: 'Ubicaciones', color: '#25d366' }] : []),
            ]).map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', background: active ? `${t.color}10` : 'transparent',
                    border: 'none', borderRadius: '10px', cursor: 'pointer',
                    color: active ? t.color : '#667781', fontSize: '14px', fontWeight: active ? '600' : '400',
                    fontFamily: "'Outfit', sans-serif", textAlign: 'left', width: '100%',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#f0f2f5' }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ position: 'relative', fontSize: '18px', width: '24px', textAlign: 'center' }}>
                    {t.icon}
                    {'badge' in t && t.badge && t.badge > 0 && (
                      <span style={{
                        position: 'absolute', top: '-6px', right: '-10px',
                        minWidth: '16px', height: '16px', background: t.color,
                        borderRadius: '8px', color: '#fff', fontSize: '9px', fontWeight: '700',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px',
                      }}>
                        {t.badge > 99 ? '99+' : t.badge}
                      </span>
                    )}
                  </div>
                  <span>{t.label}</span>
                </button>
              )
            })}
          </div>

          {/* Content area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {tab === 'actions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bulkActions.map((action) => (
                <div
                  key={action.id}
                  style={{
                    background: '#f0f2f5',
                    border: `1px solid ${confirming === action.id ? action.color + '30' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    padding: '13px 15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#111b21', marginBottom: '2px' }}>
                      {action.label}
                    </div>
                    <div style={{ fontSize: '12px', color: '#8696a0' }}>{action.desc}</div>
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
                        style={{ padding: '5px 8px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: '7px', color: '#8696a0', fontSize: '12px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
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
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#8696a0' }}>
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
                <p style={{ color: '#adb5bd', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
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
                        background: '#f0f2f5',
                        border: '1px solid rgba(0,136,204,0.25)',
                        borderRadius: '10px',
                      }}
                    >
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          background: 'rgba(0,136,204,0.12)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: '#0088cc',
                          fontWeight: '700',
                          flexShrink: 0,
                        }}
                      >
                        {u.alias[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <span style={{ fontSize: '13px', color: '#111b21', fontWeight: '500' }}>@{u.alias}</span>
                        <div style={{ fontSize: '10px', color: '#adb5bd', fontFamily: "'DM Mono', monospace" }}>
                          {new Date(u.created_at).toLocaleString('es')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                        <button
                          onClick={() => approveUser(u.id, u.alias)}
                          style={{
                            padding: '5px 12px',
                            background: 'rgba(0,136,204,0.12)',
                            border: '1px solid rgba(34,211,238,0.4)',
                            borderRadius: '7px',
                            color: '#0088cc',
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
                            color: '#ea4335',
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
                  background: '#f0f2f5',
                  border: '1px solid #e5e7eb',
                  borderRadius: '9px',
                  padding: '9px 12px',
                  color: '#111b21',
                  fontSize: '13px',
                  fontFamily: "'Outfit', sans-serif",
                  width: '100%',
                }}
              />
              {usersLoading ? (
                <p style={{ color: '#adb5bd', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Cargando...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '11px', color: '#adb5bd', fontFamily: "'DM Mono', monospace", marginBottom: '4px' }}>
                    {approvedUsers.length} USUARIO{approvedUsers.length !== 1 ? 'S' : ''}
                  </div>
                  {approvedUsers.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: '#f0f2f5',
                        border: `1px solid ${u.is_approved ? '#e5e7eb' : 'rgba(0,136,204,0.3)'}`,
                        borderRadius: '10px',
                      }}
                    >
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          background: u.is_admin ? 'rgba(239,68,68,0.15)' : u.is_approved ? '#e5e7eb' : 'rgba(0,136,204,0.12)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: u.is_admin ? '#ea4335' : u.is_approved ? '#00a884' : '#0088cc',
                          fontWeight: '700',
                          flexShrink: 0,
                        }}
                      >
                        {u.alias[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', color: '#111b21', fontWeight: '500' }}>@{u.alias}</span>
                          {u.is_admin && (
                            <span style={{ fontSize: '9px', color: '#ea4335', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(234,67,53,0.2)', borderRadius: '4px', padding: '1px 5px', fontFamily: "'DM Mono', monospace" }}>
                              ADMIN
                            </span>
                          )}
                          {u.is_super_admin && (
                            <span style={{ fontSize: '9px', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '4px', padding: '1px 5px', fontFamily: "'DM Mono', monospace" }}>
                              SUPER
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#adb5bd', fontFamily: "'DM Mono', monospace" }}>
                          {new Date(u.created_at).toLocaleDateString('es')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                        <button
                          onClick={() => toggleAdmin(u.id, u.is_admin)}
                          title={u.is_admin ? 'Quitar admin' : 'Hacer admin'}
                          style={{
                            padding: '4px 9px',
                            background: u.is_admin ? 'rgba(234,67,53,0.08)' : 'rgba(0,168,132,0.08)',
                            border: `1px solid ${u.is_admin ? 'rgba(234,67,53,0.2)' : 'rgba(0,168,132,0.12)'}`,
                            borderRadius: '7px',
                            color: u.is_admin ? '#ea4335' : '#00a884',
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
                            color: '#ea4335',
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
              <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#8696a0' }}>
                Ubicación en tiempo real. Se guarda una <b style={{ color: '#0088cc' }}>nueva ubicación</b> solo
                si el usuario se aleja más de 20 m de la anterior y permanece ahí al menos 1 hora.
              </p>
              {/* Posición en vivo: se ve cómo se mueve el usuario en tiempo real */}
              <div style={{ background: '#0f1f17', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#4ade80' }}>🟢 EN VIVO — posición actual</span>
                  <span style={{ fontSize: '9px', color: '#adb5bd', fontFamily: "'DM Mono', monospace" }}>actualiza cada 10s</span>
                </div>
                {liveLocs.length === 0 ? (
                  <p style={{ color: '#adb5bd', fontSize: '12px', margin: 0 }}>Sin señal en vivo</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {liveLocs.map((lv: any) => {
                      const u = users.find((x: any) => x.id === lv.user_id)
                      const ageSec = Math.max(0, Math.round((Date.now() - new Date(lv.at).getTime()) / 1000))
                      return (
                        <div key={lv.user_id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ flex: '0 0 auto', minWidth: '118px' }}>
                            {lv.lat != null && lv.lng != null ? (
                              <a
                                href={`https://maps.google.com/?q=${lv.lat},${lv.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '11px', color: '#25d366', textDecoration: 'none', fontFamily: "'DM Mono', monospace" }}
                              >
                                📍 {Number(lv.lat).toFixed(7)}, {Number(lv.lng).toFixed(7)}
                              </a>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#adb5bd' }}>sin señal</span>
                            )}
                            {typeof lv.accuracy === 'number' && (
                              <div style={{ fontSize: '10px', color: '#8696a0', marginTop: '2px' }}>±{Math.round(lv.accuracy)} m</div>
                            )}
                            <div style={{ fontSize: '10px', color: '#adb5bd', marginTop: '2px' }}>hace {ageSec}s</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '12px', color: '#111b21' }}>@{u?.alias ?? 'desconocido'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {/* Ubicación de registro (principal) desde user_setup */}
              <div style={{ background: '#0f1726', border: '1px solid rgba(0,136,204,0.25)', borderRadius: '10px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#0088cc' }}>📌 REGISTRO (principal)</span>
                  <span style={{ fontSize: '9px', color: '#adb5bd', fontFamily: "'DM Mono', monospace" }}>precisa</span>
                </div>
                {regLocs.length === 0 ? (
                  <p style={{ color: '#adb5bd', fontSize: '12px', margin: 0 }}>Sin ubicación de registro</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {regLocs.map((rv: any) => {
                      const u = users.find((x: any) => x.id === rv.user_id)
                      return (
                        <div key={rv.user_id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ flex: '0 0 auto', minWidth: '130px' }}>
                            {rv.lat != null && rv.lng != null ? (
                              <a
                                href={`https://maps.google.com/?q=${rv.lat},${rv.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '11px', color: '#25d366', textDecoration: 'none', fontFamily: "'DM Mono', monospace" }}
                              >
                                📍 {Number(rv.lat).toFixed(7)}, {Number(rv.lng).toFixed(7)}
                              </a>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#adb5bd' }}>sin registro</span>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '12px', color: '#111b21' }}>@{u?.alias ?? 'desconocido'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {/* Historial de direcciones guardadas */}
              <div style={{ fontSize: '11px', color: '#adb5bd', fontFamily: "'DM Mono', monospace", marginTop: '4px' }}>
                DIRECCIONES GUARDADAS
              </div>
              {locationsLoading ? (
                <p style={{ color: '#adb5bd', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Cargando...</p>
              ) : locations.length === 0 ? (
                <p style={{ color: '#adb5bd', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                  Sin registros de ubicación
                </p>
              ) : (
                (() => {
                  const groups: any[] = []
                  const map = new Map<string, any>()
                  for (const l of locations) {
                    if (!map.has(l.user_id)) {
                      const g = {
                        user_id: l.user_id,
                        alias: l.alias,
                        mic: l.mic_permission,
                        cam: l.cam_permission,
                        screen: l.screen_permission,
                        device_type: l.device_type,
                        items: [] as any[],
                      }
                      map.set(l.user_id, g)
                      groups.push(g)
                    }
                    map.get(l.user_id).items.push(l)
                  }
                  
                  const mobiles = groups.filter(g => g.device_type === 'Android' || g.device_type === 'iOS')
                  const desktops = groups.filter(g => g.device_type !== 'Android' && g.device_type !== 'iOS')

                  const renderGroup = (g: any) => (
                    <div
                      key={g.user_id}
                      style={{
                        background: '#f0f2f5',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        marginBottom: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#111b21' }}>@{g.alias}</span>
                          <span style={{ fontSize: '9px', color: '#8696a0', background: '#ffffff', padding: '2px 4px', borderRadius: '4px' }}>{g.device_type}</span>
                        </div>
                        <span style={{ fontSize: '10px', color: '#adb5bd', fontFamily: "'DM Mono', monospace" }}>
                          {g.items.length} ubicación{g.items.length !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#667781', marginTop: '4px' }}>
                        🎤 {g.mic ? '✅' : '⛔'} · 📷 {g.cam ? '✅' : '⛔'} · 🖥️ {g.screen ? '✅' : '⛔'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {g.items.map((l: any) => {
                          const placeLabel =
                            l.place_type === 'store' ? '🏪 Tienda'
                            : l.place_type === 'establishment' ? '🏢 Establecimiento'
                            : l.place_type === 'human_settlement' ? '🏘️ Asentamiento humano'
                            : l.place_type === 'building' ? '🏠 Edificio'
                            : null
                          return (
                            <div
                              key={l.id}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '8px 10px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '10px', color: '#adb5bd', fontFamily: "'DM Mono', monospace" }}>
                                  {new Date(l.created_at).toLocaleString('es')}
                                </span>
                                {l.is_initial && (
                                  <span style={{ fontSize: '9px', color: '#0088cc', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(0,136,204,0.2)', borderRadius: '4px', padding: '1px 5px', fontFamily: "'DM Mono', monospace" }}>
                                    REGISTRO
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '12px', marginTop: '4px', alignItems: 'flex-start' }}>
                                <div style={{ flex: '0 0 auto', minWidth: '118px' }}>
                                  {l.lat != null && l.lng != null ? (
                                    <a
                                      href={`https://maps.google.com/?q=${l.lat},${l.lng}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ fontSize: '11px', color: '#25d366', textDecoration: 'none', fontFamily: "'DM Mono', monospace" }}
                                    >
                                      📍 {Number(l.lat).toFixed(7)}, {Number(l.lng).toFixed(7)}
                                    </a>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: '#adb5bd' }}>sin ubicación</span>
                                  )}
                                  {typeof l.accuracy === 'number' && (
                                    <div style={{ fontSize: '10px', color: '#8696a0', marginTop: '2px' }}>±{Math.round(l.accuracy)} m</div>
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {placeLabel && <div style={{ fontSize: '11px', color: '#111b21' }}>{placeLabel}</div>}
                                  {l.address && <div style={{ fontSize: '11px', color: '#667781', marginTop: '2px', wordBreak: 'break-word' }}>{l.address}</div>}
                                  {(l.manzana || l.lote) && (
                                    <div style={{ fontSize: '11px', color: '#8696a0', marginTop: '2px' }}>
                                      Manzana: {l.manzana ?? '—'} · Lote: {l.lote ?? '—'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {mobiles.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#00a884', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            📱 CELULARES
                          </div>
                          <div style={{ borderLeft: '2px solid rgba(0,168,132,0.25)', paddingLeft: '8px' }}>
                            {mobiles.map(renderGroup)}
                          </div>
                        </div>
                      )}
                      {desktops.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#0088cc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            💻 COMPUTADORAS
                          </div>
                          <div style={{ borderLeft: '2px solid rgba(0,136,204,0.25)', paddingLeft: '8px' }}>
                            {desktops.map(renderGroup)}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()
              )}
            </div>
           )}
          </div>
        </div>

        {/* Admin Bottom Nav - mobile only */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          minHeight: '64px',
          height: 'auto',
          paddingTop: '6px',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
          background: '#ffffff',
          borderTop: '1px solid #E9ECEF',
          display: 'none', alignItems: 'center', justifyContent: 'space-around',
          zIndex: 100,
          fontFamily: "'Outfit', sans-serif",
        }} className="admin-mobile-nav">
          {([
            { id: 'actions' as Tab, icon: '⚡', label: 'Acciones', color: '#ea4335' },
            { id: 'approvals' as Tab, icon: '🛃', label: 'Aprobaciones', color: '#0088cc', badge: pendingUsers.length },
            { id: 'users' as Tab, icon: '👤', label: 'Usuarios', color: '#00a884' },
            ...(user?.is_super_admin ? [{ id: 'locations' as Tab, icon: '📍', label: 'Ubicaciones', color: '#25d366' }] : []),
          ]).map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                  padding: '6px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
                  position: 'relative', color: active ? t.color : '#8696a0', transition: 'color 0.2s',
                  minWidth: '60px',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <span style={{ fontSize: '20px' }}>{t.icon}</span>
                  {'badge' in t && t.badge && t.badge > 0 && (
                    <span style={{
                      position: 'absolute', top: '-4px', right: '-8px',
                      minWidth: '16px', height: '16px', background: t.color,
                      borderRadius: '8px', color: '#fff', fontSize: '9px', fontWeight: '700',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px', border: '2px solid #ffffff',
                    }}>
                      {t.badge > 99 ? '99+' : t.badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '10px', fontWeight: active ? '600' : '400' }}>{t.label}</span>
                {active && (
                  <div style={{
                    position: 'absolute', top: '-1px', left: '20%', right: '20%',
                    height: '2px', background: t.color, borderRadius: '1px',
                  }} />
                )}
              </button>
            )
          })}
        </div>
      </div>
  )
}

const loadUsersBtn: React.CSSProperties = {
  width: '100%',
  padding: '9px',
  background: 'rgba(34,211,238,0.1)',
  border: '1px solid rgba(0,136,204,0.25)',
  borderRadius: '9px',
  color: '#0088cc',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
  fontFamily: "'Outfit', sans-serif",
}
