import { useState, useEffect, useCallback } from 'react'

type Toast = { id: number; msg: string; type: 'error' | 'info' | 'ok' }

let _emit: ((t: Omit<Toast, 'id'>) => void) | null = null

export function showToast(msg: string, type: Toast['type'] = 'error') {
  _emit?.({ msg, type })
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-4), { ...t, id }])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000)
  }, [])

  useEffect(() => {
    _emit = add
    return () => { _emit = null }
  }, [add])

  if (!toasts.length) return null

  return (
    <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 8, width: '90%', maxWidth: 400 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: t.type === 'error' ? '#3b1116' : t.type === 'ok' ? '#0b3b2a' : '#1a1a3a',
            border: `1px solid ${t.type === 'error' ? '#ef4444' : t.type === 'ok' ? '#22c55e' : '#8b5cf6'}`,
            borderRadius: 10,
            padding: '12px 16px',
            color: '#fff',
            fontSize: 13,
            fontFamily: "'Outfit', sans-serif",
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            wordBreak: 'break-word',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: t.type === 'error' ? '#f87171' : t.type === 'ok' ? '#4ade80' : '#a78bfa' }}>
            {t.type === 'error' ? 'ERROR' : t.type === 'ok' ? 'OK' : 'INFO'}
          </div>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
