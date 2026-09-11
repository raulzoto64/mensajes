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

type Props = {
  onCallGroup: (groupId: string, groupName: string) => void
}

export default function CallsTab({ onCallGroup }: Props) {
  const { user } = useAuth()
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCalls()
  }, [user])

  async function loadCalls() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('call_logs')
      .select('*, users!call_logs_caller_id_fkey(alias), groups!call_logs_group_id_fkey(name)')
      .order('started_at', { ascending: false })
      .limit(50)

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

  const today = calls.filter((c) => Date.now() - new Date(c.started_at).getTime() < 86400000)
  const older = calls.filter((c) => Date.now() - new Date(c.started_at).getTime() >= 86400000)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      {/* Today */}
      {today.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', padding: '0 4px 8px' }}>
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
          <div style={{ fontSize: '10px', color: '#3d3d5c', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', padding: '0 4px 8px' }}>
            ANTERIORES
          </div>
          {older.map((call) => (
            <CallItem key={call.id} call={call} onCallGroup={onCallGroup} timeAgo={timeAgo} formatDuration={formatDuration} />
          ))}
        </div>
      )}

      {!loading && calls.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#3d3d5c' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📞</div>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px', color: '#6b6b8a' }}>
            Sin llamadas
          </div>
          <div style={{ fontSize: '12px' }}>
            Las llamadas de grupo aparecerán aquí
          </div>
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
          background: call.group_id ? 'rgba(139,92,246,0.15)' : 'rgba(34,211,238,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {call.group_id ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: '13px', fontWeight: '500', color: missed ? '#f87171' : '#e8e8f0' }}>
          {call.group_name ? `#${call.group_name}` : `@${call.caller_alias}`}
        </div>
        <div style={{ fontSize: '11px', color: missed ? '#f87171' : '#6b6b8a', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: '8px',
            color: '#c4b5fd',
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
