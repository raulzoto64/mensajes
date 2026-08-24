import { useState } from 'react'
import { DURATION_OPTIONS } from '../lib/expire'

type Props = {
  title: string
  current: number
  onClose: () => void
  onSave: (hours: number) => void | Promise<void>
}

const FONT = "'Outfit', sans-serif"

export default function DurationSettingsModal({ title, current, onClose, onSave }: Props) {
  const [value, setValue] = useState<number>(current && current > 0 ? current : 24)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(value)
    setSaving(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(7,7,17,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 400,
        backdropFilter: 'blur(6px)',
        fontFamily: FONT,
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
          maxWidth: '380px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid #1e1e3a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#e8e8f0' }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{ background: '#14142a', border: '1px solid #1e1e3a', borderRadius: '8px', padding: '6px 10px', color: '#6b6b8a', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#6b6b8a' }}>
            Los mensajes se borran automáticamente pasada esta duración. La multimedia de vista única se borra al ser vista, sin importar esto.
          </p>
        </div>

        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {DURATION_OPTIONS.map((opt) => {
            const active = value === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setValue(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 14px',
                  background: active ? 'rgba(139,92,246,0.12)' : '#14142a',
                  border: `1px solid ${active ? '#8b5cf6' : '#1e1e3a'}`,
                  borderRadius: '10px',
                  color: active ? '#c4b5fd' : '#9090b0',
                  fontSize: '13px',
                  fontWeight: active ? '600' : '400',
                  cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                <span>{opt.label}</span>
                {active && <span style={{ fontSize: '12px' }}>✓</span>}
              </button>
            )
          })}
        </div>

        <div style={{ padding: '0 22px 20px', display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: '10px',
              background: '#8b5cf6',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: saving ? 'default' : 'pointer',
              fontFamily: FONT,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={onClose}
            style={{ padding: '10px 16px', background: '#14142a', border: '1px solid #1e1e3a', borderRadius: '10px', color: '#6b6b8a', fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
