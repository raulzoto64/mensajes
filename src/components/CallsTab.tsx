import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type CallRecord = {
  id: string
  caller_id: string
  caller_alias: string
  group_id: string | null
  group_name: string | null
  started_at: string
  ended_at: string | null
  duration: number | null
  type: 'audio' | 'video'
}

type Contact = {
  id: string
  alias: string
  avatar_url: string | null
}

type Props = {
  onCallGroup: (groupId: string, groupName: string) => void
}

export default function CallsTab({ onCallGroup }: Props) {
  const { user } = useAuth()
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [showContacts, setShowContacts] = useState(false)

  const canSeeAll = user?.is_admin || user?.is_super_admin

  useEffect(() => {
    loadCalls()
    loadContacts()
  }, [user])

  async function loadCalls() {
    if (!user) return
    setLoading(true)

    let query = supabase
      .from('call_logs')
      .select('*, users!call_logs_caller_id_fkey(alias), groups!call_logs_group_id_fkey(name)')
      .order('started_at', { ascending: false })
      .limit(100)

    // Non-admins only see their own calls
    if (!canSeeAll) {
      query = query.or(`caller_id.eq.${user.id}`)
    }

    const { data } = await query

    if (data) {
      setCalls(
        data.map((c: any) => ({
          id: c.id,
          caller_id: c.caller_id,
          caller_alias: c.users?.alias ?? 'usuario',
          group_id: c.group_id,
          group_name: c.groups?.name ?? null,
          started_at: c.started_at,
          ended_at: c.ended_at,
          duration: c.duration,
          type: c.type ?? 'audio',
        })),
      )
    }
    setLoading(false)
  }

  async function loadContacts() {
    const { data } = await supabase
      .from('users')
      .select('id, alias, avatar_url')
      .eq('is_approved', true)
      .order('alias')

    setContacts(data ?? [])
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return 'Sin conectar'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  const filteredContacts = contacts.filter(c =>
    c.id !== user?.id && c.alias.toLowerCase().includes(search.toLowerCase())
  )

  const today = calls.filter((c) => Date.now() - new Date(c.started_at).getTime() < 86400000)
  const older = calls.filter((c) => Date.now() - new Date(c.started_at).getTime() >= 86400000)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      {/* Search contacts to call */}
      <div style={{ marginBottom: '16px' }}>
        <div
          onClick={() => setShowContacts(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', background: '#f0f2f5', borderRadius: '12px',
            cursor: 'pointer', border: '1px solid #e5e7eb',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#00a884')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00a884" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span style={{ fontSize: '14px', color: '#8696a0', flex: 1 }}>Buscar contactos para llamar...</span>
          <span style={{ fontSize: '12px', color: '#adb5bd', transform: showContacts ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
        </div>

        {showContacts && (
          <div style={{ marginTop: '8px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f2f5' }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Escribe un alias..."
                autoFocus
                style={{
                  width: '100%', background: '#f0f2f5', border: '1px solid #e5e7eb',
                  borderRadius: '8px', padding: '8px 12px', color: '#111b21', fontSize: '13px',
                  fontFamily: "'Outfit', sans-serif", outline: 'none',
                }}
              />
            </div>
            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {filteredContacts.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#adb5bd', fontSize: '12px' }}>Sin resultados</div>
              )}
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f2f5')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: contact.avatar_url ? 'transparent' : 'rgba(0,168,132,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', flexShrink: 0,
                  }}>
                    {contact.avatar_url ? (
                      <img src={contact.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '14px', color: '#00a884', fontWeight: '700' }}>{contact.alias[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    @{contact.alias}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      title="Llamar audio"
                      style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: 'rgba(0,168,132,0.1)', border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00a884" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Today */}
      {today.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#adb5bd', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', padding: '0 4px 8px' }}>
            HOY
          </div>
          {today.map((call) => (
            <CallItem key={call.id} call={call} onCallGroup={onCallGroup} timeAgo={timeAgo} formatDuration={formatDuration} />
          ))}
        </div>
      )}

      {/* Older */}
      {older.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', color: '#adb5bd', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', padding: '0 4px 8px' }}>
            ANTERIORES
          </div>
          {older.map((call) => (
            <CallItem key={call.id} call={call} onCallGroup={onCallGroup} timeAgo={timeAgo} formatDuration={formatDuration} />
          ))}
        </div>
      )}

      {!loading && calls.length === 0 && !showContacts && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#adb5bd' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📞</div>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: '#8696a0' }}>
            Sin llamadas
          </div>
          <div style={{ fontSize: '12px' }}>
            Usa la búsqueda para llamar a un contacto
          </div>
        </div>
      )}

      {!canSeeAll && !loading && calls.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', marginTop: '8px', fontSize: '11px', color: '#8696a0', textAlign: 'center' }}>
          Solo ves tus propias llamadas
        </div>
      )}
    </div>
  )
}

function CallItem({
  call,
  onCallGroup,
  timeAgo,
  formatDuration,
}: {
  call: CallRecord
  onCallGroup: (groupId: string, groupName: string) => void
  timeAgo: (date: string) => string
  formatDuration: (seconds: number | null) => string
}) {
  const missed = !call.ended_at
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        borderRadius: '10px',
        marginBottom: '2px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: call.group_id ? 'rgba(0,168,132,0.12)' : 'rgba(0,136,204,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {call.group_id ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00a884" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0088cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: '13px', fontWeight: '500', color: missed ? '#ea4335' : '#111b21' }}>
          {call.group_name ? `#${call.group_name}` : `@${call.caller_alias}`}
        </div>
        <div style={{ fontSize: '11px', color: missed ? '#ea4335' : '#8696a0', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {missed ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          ) : null}
          {timeAgo(call.started_at)} · {formatDuration(call.duration)}
        </div>
      </div>
      {call.group_id && (
        <button
          onClick={() => onCallGroup(call.group_id!, call.group_name ?? 'grupo')}
          style={{
            padding: '6px 12px',
            background: 'rgba(0,168,132,0.1)',
            border: '1px solid rgba(0,168,132,0.2)',
            borderRadius: '8px',
            color: '#00a884',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          Llamar
        </button>
      )}
    </div>
  )
}
