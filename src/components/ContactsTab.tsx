import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type User = {
  id: string
  alias: string
  phone: string | null
  phone_hidden: boolean
  avatar_url: string | null
}

export default function ContactsTab() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const canSeePhones = user?.is_admin || user?.is_super_admin

  useEffect(() => {
    loadContacts()
  }, [])

  async function loadContacts() {
    const { data } = await supabase
      .from('users')
      .select('id, alias, phone, phone_hidden, avatar_url')
      .eq('is_approved', true)
      .order('alias')

    setContacts(data ?? [])
    setLoading(false)
  }

  const filtered = contacts.filter(c =>
    c.alias.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Search bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contactos..."
            style={{
              width: '100%',
              background: '#f0f2f5',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              padding: '10px 12px 10px 38px',
              color: '#111b21',
              fontSize: '14px',
              fontFamily: "'Outfit', sans-serif",
            }}
          />
        </div>
      </div>

      {/* Contact list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8696a0', fontSize: '13px' }}>Cargando...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#adb5bd' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>👤</div>
            <div style={{ fontSize: '13px' }}>No se encontraron contactos</div>
          </div>
        )}

        {filtered.map((contact) => (
          <div
            key={contact.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderBottom: '1px solid #f0f2f5',
              cursor: 'default',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f9fa')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Avatar */}
            <div style={{
              width: '42px', height: '42px', borderRadius: '50%',
              background: contact.avatar_url ? 'transparent' : 'rgba(0,168,132,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {contact.avatar_url ? (
                <img src={contact.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '16px', color: '#00a884', fontWeight: '700' }}>{contact.alias[0]?.toUpperCase()}</span>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{contact.alias}
              </div>
              {canSeePhones && contact.phone && (
                <div style={{ fontSize: '12px', color: '#8696a0', marginTop: '2px' }}>
                  {contact.phone_hidden ? '🔒 Número oculto' : `🇵🇪 ${contact.phone}`}
                </div>
              )}
              {canSeePhones && !contact.phone && (
                <div style={{ fontSize: '12px', color: '#adb5bd', marginTop: '2px' }}>Sin número</div>
              )}
              {!canSeePhones && (
                <div style={{ fontSize: '12px', color: '#adb5bd', marginTop: '2px' }}>Contacto</div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                title="Enviar mensaje"
                onClick={() => alert(`Iniciar mensaje con @${contact.alias}`)}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(0,168,132,0.1)',
                  border: '1px solid rgba(0,168,132,0.2)',
                  borderRadius: '8px',
                  color: '#00a884',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                💬
              </button>
              <button
                title="Llamar"
                onClick={() => alert(`Llamando a @${contact.alias}`)}
                style={{
                  padding: '6px 10px',
                  background: 'rgba(0,136,204,0.1)',
                  border: '1px solid rgba(0,136,204,0.2)',
                  borderRadius: '8px',
                  color: '#0088cc',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                📞
              </button>
            </div>
          </div>
        ))}
      </div>

      {!canSeePhones && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', background: '#f8f9fa', fontSize: '11px', color: '#8696a0', textAlign: 'center' }}>
          Los números de contacto son visibles solo para administradores
        </div>
      )}
    </div>
  )
}
