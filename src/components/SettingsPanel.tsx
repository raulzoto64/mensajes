import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { verifyPassword, generateSalt, hashPassword } from '../lib/crypto'

type Props = {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: Props) {
  const { user, setUser } = useAuth()
  const [phone, setPhone] = useState(user?.phone?.replace('+51', '') ?? '')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [hidePhone, setHidePhone] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  async function savePhone() {
    if (!user || !phone.trim()) return
    setSaving(true)
    setMsg(null)
    const full = `+51${phone.trim()}`
    const { error } = await supabase.from('users').update({ phone: full }).eq('id', user.id)
    if (error) setMsg({ type: 'err', text: error.message })
    else {
      const updated = { ...user, phone: full }
      setUser(updated)
      localStorage.setItem('ephemera_session', JSON.stringify(updated))
      setMsg({ type: 'ok', text: 'Celular actualizado.' })
    }
    setSaving(false)
  }

  async function saveEmail() {
    if (!user || !email.trim()) return
    setSaving(true)
    setMsg(null)
    const { error } = await supabase.from('users').update({ recovery_email: email.trim() }).eq('id', user.id)
    if (error) setMsg({ type: 'err', text: error.message })
    else setMsg({ type: 'ok', text: 'Correo de recuperación guardado.' })
    setSaving(false)
  }

  async function changePassword() {
    if (!user || !currentPassword || !newPassword) return
    setSaving(true)
    setMsg(null)
    const { data, error: fetchErr } = await supabase.from('users').select('password_hash, salt').eq('id', user.id).single()
    if (fetchErr || !data) { setMsg({ type: 'err', text: 'Error al verificar contraseña.' }); setSaving(false); return }

    const valid = await verifyPassword(currentPassword, data.salt, data.password_hash)
    if (!valid) { setMsg({ type: 'err', text: 'La contraseña actual es incorrecta.' }); setSaving(false); return }

    const salt = generateSalt()
    const hash = await hashPassword(newPassword, salt)
    const { error } = await supabase.from('users').update({ password_hash: hash, salt }).eq('id', user.id)
    if (error) setMsg({ type: 'err', text: error.message })
    else { setMsg({ type: 'ok', text: 'Contraseña cambiada.' }); setCurrentPassword(''); setNewPassword('') }
    setSaving(false)
  }

  async function saveHidePhone() {
    if (!user) return
    const { error } = await supabase.from('users').update({ phone_hidden: hidePhone }).eq('id', user.id)
    if (!error) {
      const updated = { ...user, phone_hidden: hidePhone }
      setUser(updated)
      localStorage.setItem('ephemera_session', JSON.stringify(updated))
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#f0f2f5',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '11px 14px',
    color: '#111b21',
    fontSize: '14px',
    fontFamily: "'Outfit', sans-serif",
    transition: 'border-color 0.2s',
  }

  const btnStyle: React.CSSProperties = {
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #00a884, #0088cc)',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#00a884', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>{title}</div>
        {children}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f0f2f5', zIndex: 150, display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#111b21', padding: '4px' }}>←</button>
        <span style={{ fontSize: '17px', fontWeight: '600', color: '#111b21' }}>Configuración y Privacidad</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 80px' }}>
        <Section title="Celular">
          <div style={{ display: 'flex', gap: '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0f2f5', border: '1px solid #e5e7eb', borderRight: 'none', borderRadius: '10px 0 0 10px', padding: '0 12px', fontSize: '15px', color: '#111b21', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '18px' }}>🇵🇪</span>
              <span style={{ fontWeight: '500', fontSize: '14px' }}>+51</span>
            </div>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} placeholder="999 888 777" style={{ ...inputStyle, borderRadius: '0 10px 10px 0', flex: 1 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <label style={{ fontSize: '13px', color: '#667781', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={hidePhone} onChange={(e) => { setHidePhone(e.target.checked); saveHidePhone() }} style={{ accentColor: '#00a884' }} />
              Ocultar mi número
            </label>
            <button onClick={savePhone} disabled={saving} style={btnStyle}>Guardar</button>
          </div>
        </Section>

        <Section title="Correo de recuperación">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" style={inputStyle} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button onClick={saveEmail} disabled={saving} style={btnStyle}>Guardar</button>
          </div>
        </Section>

        <Section title="Cambiar contraseña">
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <input type={showCurrentPw ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Contraseña actual" style={{ ...inputStyle, paddingRight: '40px' }} />
            <button type="button" onClick={() => setShowCurrentPw(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', fontSize: '13px' }}>
              {showCurrentPw ? '🙈' : '👁️'}
            </button>
          </div>
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nueva contraseña" style={{ ...inputStyle, paddingRight: '40px' }} />
            <button type="button" onClick={() => setShowNewPw(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', fontSize: '13px' }}>
              {showNewPw ? '🙈' : '👁️'}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={changePassword} disabled={saving || !currentPassword || !newPassword} style={btnStyle}>Cambiar</button>
          </div>
        </Section>

        {msg && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', background: msg.type === 'ok' ? 'rgba(0,168,132,0.1)' : 'rgba(239,68,68,0.1)', color: msg.type === 'ok' ? '#00a884' : '#ea4335', border: `1px solid ${msg.type === 'ok' ? 'rgba(0,168,132,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}
