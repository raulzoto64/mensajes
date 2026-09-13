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
          background: '#ffffff',
          border: '1px solid #d1d7db',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '380px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#111b21' }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{ background: '#f0f2f5', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 10px', color: '#8696a0', cursor: 'pointer', fontSize: '14px' }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#8696a0' }}>
            Los mensajes de texto se borran automáticamente pasada esta duración. La multimedia se borra al ser vista por todos.
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
                  background: active ? 'rgba(0,168,132,0.1)' : '#f0f2f5',
                  border: `1px solid ${active ? '#00a884' : '#e5e7eb'}`,
                  borderRadius: '10px',
                  color: active ? '#00a884' : '#667781',
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
              background: '#00a884',
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
            style={{ padding: '10px 16px', background: '#f0f2f5', border: '1px solid #e5e7eb', borderRadius: '10px', color: '#8696a0', fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
