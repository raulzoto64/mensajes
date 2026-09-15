import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function DebugPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [subs, setSubs] = useState<any[]>([])

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  useEffect(() => {
    addLog('DebugPage cargada')
    addLog(`isNative: ${!window.Capacitor?.isNative ? 'false' : 'true'}`)
    addLog(`UserAgent: ${navigator.userAgent}`)
    addLog(`Platform: ${navigator.platform}`)

    // Ver suscripciones push
    supabase.from('push_subscriptions').select('*').then(({ data }) => {
      setSubs(data || [])
      addLog(`Suscripciones push: ${data?.length || 0}`)
    })
  }, [])

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', background: '#0a0a0f', color: '#e2e2e2', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, marginBottom: 16, color: '#8b5cf6' }}>🔧 Panel de Depuración</h1>
      <div style={{ marginBottom: 16 }}>
        <strong>Estado de plugins nativos:</strong> Desactivados (para evitar crash)
      </div>
      <div style={{ background: '#14142a', border: '1px solid #1e1e3a', borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginBottom: 8, fontSize: 16 }}>📋 Logs en tiempo real</h3>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: '#a0a0c0', maxHeight: 300, overflowY: 'auto' }}>
          {logs.map((l, i) => (
            <div key={i} style={{ wordBreak: 'break-word' }}>{l}</div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, background: '#14142a', border: '1px solid #1e1e3a', borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginBottom: 8, fontSize: 16 }}>📡 Suscripciones Push</h3>
        {subs.length === 0 ? (
          <div style={{ color: '#f87171' }}>No hay suscripciones registradas</div>
        ) : (
          subs.map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: '#67e8f9', marginBottom: 4 }}>
              endpoint: {s.endpoint?.slice(0, 60)}... | user_id: {s.user_id}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
