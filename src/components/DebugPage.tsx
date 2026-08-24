import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { collectDiagnostics, saveDeviceLog, listDeviceLogs, sendTestPush, type Diagnostics } from '../lib/debug'

function Check({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        fontSize: '11px',
        fontWeight: '700',
        background: ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        color: ok ? '#22c55e' : '#f87171',
        border: `1px solid ${ok ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
      }}
    >
      {ok ? '✓' : '✕'}
    </span>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #14142a', fontSize: '12px' }}>
      <span style={{ color: '#6b6b8a' }}>{label}</span>
      <span style={{ color: '#e8e8f0', fontWeight: '500', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

export default function DebugPage() {
  const { user } = useAuth()
  const [diag, setDiag] = useState<Diagnostics | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [testResult, setTestResult] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [locStatus, setLocStatus] = useState<string>('')

  const refreshLogs = useCallback(async () => {
    if (!user) return
    setLogs(await listDeviceLogs())
  }, [user])

  useEffect(() => {
    if (!user) return
    (async () => {
      const d = await collectDiagnostics(user.id)
      setDiag(d)
      await saveDeviceLog(user.id, d)
      await refreshLogs()
    })()
  }, [user, refreshLogs])

  async function handleTest() {
    if (!user) return
    setSending(true)
    setTestResult(null)
    const res = await sendTestPush(user.id)
    setSending(false)
    if (res.ok) {
      setTestResult(`Resultado: enviadas=${res.sent ?? 0}, fallidas=${res.failed ?? 0}. Ahora pon la app en SEGUNDO PLANO (no la cierres del todo) y espera ~10s. Si llega la notificación del sistema, el push funciona.`)
    } else {
      setTestResult(`Error al enviar push de prueba: ${res.error}`)
    }
  }

  async function handleLocation() {
    if (!user || !diag) return
    if (!navigator.geolocation) { setLocStatus('Geolocalización no disponible'); return }
    setLocStatus('Solicitando ubicación…')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await saveDeviceLog(user.id, diag, { lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocStatus(`Ubicación registrada: ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`)
        await refreshLogs()
      },
      (err) => setLocStatus(`No se pudo obtener ubicación: ${err.message}`),
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }

  if (!user) {
    return <div style={{ padding: 24, color: '#9090b0', fontFamily: "'Outfit', sans-serif" }}>Inicia sesión para ver el diagnóstico.</div>
  }

  const pushOk = diag?.pushPermission === 'granted'
  const subOk = (diag?.hasSubLocal && diag?.hasSubDb) ?? false

  return (
    <div style={{ minHeight: '100vh', background: '#070711', color: '#e8e8f0', fontFamily: "'Outfit', sans-serif", padding: '20px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: '18px', margin: '0 0 4px' }}>🔧 Diagnóstico de notificaciones</h1>
      <p style={{ color: '#6b6b8a', fontSize: '12px', margin: '0 0 18px' }}>
        Esta página registra cada acceso y permite enviar un push de prueba a este dispositivo para saber si llega en segundo plano.
      </p>

      {/* Mi estado */}
      <div style={{ background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: '14px', padding: '16px', marginBottom: 16 }}>
        <h2 style={{ fontSize: '14px', margin: '0 0 10px', color: '#c4b5fd' }}>Mi estado de push</h2>
        {!diag ? (
          <p style={{ color: '#6b6b8a', fontSize: '12px' }}>Cargando…</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Check ok={diag.swRegistered} /> <span style={{ fontSize: '12px' }}>Service Worker registrado</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Check ok={pushOk} /> <span style={{ fontSize: '12px' }}>Permiso de notificaciones concedido ({diag.pushPermission})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Check ok={diag.hasSubLocal} /> <span style={{ fontSize: '12px' }}>Suscripción local de push existe</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Check ok={diag.hasSubDb} /> <span style={{ fontSize: '12px' }}>Suscripción guardada en la BD</span>
            </div>

            <Row label="Dispositivo" value={diag.deviceType} />
            <Row label="Navegador" value={diag.browser} />
            <Row label="Sistema" value={diag.os} />
            <Row label="En línea" value={diag.online ? 'Sí' : 'No'} />
          </>
        )}
      </div>

      {/* Probar push */}
      <div style={{ background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: '14px', padding: '16px', marginBottom: 16 }}>
        <h2 style={{ fontSize: '14px', margin: '0 0 10px', color: '#67e8f9' }}>Probar push de prueba</h2>
        <button
          onClick={handleTest}
          disabled={sending || !subOk}
          style={{
            width: '100%', padding: '10px', borderRadius: 10, border: 'none',
            background: subOk ? '#22d3ee' : '#2a2a50', color: subOk ? '#070711' : '#3d3d5c',
            fontWeight: 700, fontSize: 13, cursor: subOk ? 'pointer' : 'default', fontFamily: "'Outfit', sans-serif'",
          }}
        >
          {sending ? 'Enviando…' : 'Enviar push de prueba a este dispositivo'}
        </button>
        {!subOk && (
          <p style={{ color: '#fbbf24', fontSize: '11px', margin: '8px 0 0', lineHeight: 1.4 }}>
            No hay suscripción válida. Activa las notificaciones en la campanita y recarga esta página.
          </p>
        )}
        {testResult && (
          <p style={{ color: '#9090b0', fontSize: '12px', margin: '10px 0 0', lineHeight: 1.5 }}>{testResult}</p>
        )}
        <button
          onClick={handleLocation}
          style={{ marginTop: 10, padding: '7px 12px', background: '#14142a', border: '1px solid #1e1e3a', borderRadius: 8, color: '#c4b5fd', fontSize: 12, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
        >
          📍 Registrar mi ubicación en este acceso
        </button>
        {locStatus && <p style={{ color: '#6b6b8a', fontSize: '11px', margin: '8px 0 0' }}>{locStatus}</p>}
      </div>

      {/* Accesos registrados */}
      <div style={{ background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: '14px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontSize: '14px', margin: 0, color: '#c4b5fd' }}>Accesos registrados</h2>
          <button onClick={refreshLogs} style={{ background: 'transparent', border: '1px solid #1e1e3a', borderRadius: 8, color: '#67e8f9', fontSize: 11, padding: '4px 10px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>Actualizar</button>
        </div>
        {logs.length === 0 ? (
          <p style={{ color: '#3d3d5c', fontSize: '12px' }}>Sin registros aún.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {logs.map((l) => (
              <div key={l.id} style={{ background: '#14142a', border: '1px solid #1e1e3a', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#e8e8f0' }}>
                    {l.device_type} · {l.browser}
                  </span>
                  <span style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace" }}>
                    {new Date(l.created_at).toLocaleString('es')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', color: l.push_permission === 'granted' ? '#22c55e' : '#f87171' }}>
                    perm: {l.push_permission}
                  </span>
                  <span style={{ fontSize: '10px', color: l.has_sub_db ? '#22c55e' : '#f87171' }}>
                    BD-sub: {l.has_sub_db ? 'sí' : 'no'}
                  </span>
                  <span style={{ fontSize: '10px', color: l.sw_registered ? '#22c55e' : '#f87171' }}>
                    SW: {l.sw_registered ? 'sí' : 'no'}
                  </span>
                  {l.lat != null && (
                    <span style={{ fontSize: '10px', color: '#67e8f9' }}>
                      📍 {Number(l.lat).toFixed(2)}, {Number(l.lng).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
