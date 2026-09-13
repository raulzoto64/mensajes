import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { callManager, type CallState } from '../lib/call'

interface CallApi extends CallState {
  startCall: (callId: string, participants: { userId: string; alias: string }[]) => void
  acceptCall: () => void
  rejectCall: () => void
  hangUp: () => void
  toggleMute: () => void
}

const Ctx = createContext<CallApi>(null as any)

export function useCall() {
  return useContext(Ctx)
}

function peerStateLabel(s: string) {
  if (s === 'connected' || s === 'new') return ''
  return ` · ${s}`
}

function AudioPeer({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream
      // Intentar reproducir inmediatamente para desbloquear autoplay
      ref.current.play()
        .catch((e) => console.warn('[FRONT] AudioPeer: play() bloqueado (autoplay):', e?.message ?? e))
    } else if (ref.current && !stream) {
      ref.current.srcObject = null
    }
  }, [stream])
  const handlePress = () => {
    ref.current?.play().catch((e) => console.warn('[FRONT] AudioPeer: play() falló tras clic:', e?.message ?? e))
  }
  return <audio ref={ref} autoPlay playsInline onClick={handlePress} style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }} />
}

function CallOverlay({ state }: { state: CallState }) {
  const { acceptCall, rejectCall, hangUp, toggleMute } = useCall()

  if (state.incoming && state.status === 'idle') {
    const inc = state.incoming
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7,7,17,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 500,
          backdropFilter: 'blur(4px)',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #d1d7db',
            borderRadius: '18px',
            padding: '26px 28px',
            width: 'min(360px, 90vw)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>📞</div>
          <div style={{ fontSize: '16px', color: '#111b21', fontWeight: '600' }}>Llamada entrante</div>
          <div style={{ fontSize: '13px', color: '#667781', marginTop: '4px' }}>
            de @{inc.initiatorAlias}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'center' }}>
            <button
              onClick={rejectCall}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid rgba(234,67,53,0.3)', background: 'rgba(234,67,53,0.12)', color: '#ea4335', fontWeight: '600', cursor: 'pointer' }}
            >
              Rechazar
            </button>
            <button
              onClick={acceptCall}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontWeight: '600', cursor: 'pointer' }}
            >
              Contestar
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (state.status === 'idle' || state.status === 'ended') return null

  const others = Object.values(state.peers)
  const connected = others.filter((p) => p.state === 'connected').length

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#ffffff',
        border: '1px solid #d1d7db',
        borderRadius: '16px',
        padding: '14px 16px',
        width: 'min(420px, 94vw)',
        zIndex: 500,
        fontFamily: "'Outfit', sans-serif",
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '13px', color: '#111b21', fontWeight: '600' }}>
          📞 {state.status === 'calling' ? 'Llamando…' : connected > 0 ? 'En llamada' : 'Conectando…'}
        </div>
        <div style={{ fontSize: '10px', color: '#adb5bd', fontFamily: "'DM Mono', monospace" }}>
          {state.kind === 'audio' ? 'AUDIO' : 'VIDEO'}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {state.participants.map((p) => {
          const peer = state.peers[p.userId]
          const connected = peer?.state === 'connected'
          return (
            <div
              key={p.userId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f0f2f5',
                border: `1px solid ${connected ? 'rgba(34,197,94,0.4)' : '#e5e7eb'}`,
                borderRadius: '8px',
                padding: '5px 9px',
                fontSize: '12px',
                color: connected ? '#111b21' : '#8696a0',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: connected ? '#25d366' : '#adb5bd',
                }}
              />
              @{p.alias}
              {peer && peerStateLabel(peer.state)}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={toggleMute}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '10px',
            border: `1px solid ${state.muted ? 'rgba(239,68,68,0.4)' : '#e5e7eb'}`,
            background: state.muted ? 'rgba(234,67,53,0.12)' : '#f0f2f5',
            color: state.muted ? '#ea4335' : '#111b21',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {state.muted ? '🔇 Activar mic' : '🎤 Silenciar'}
        </button>
        <button
          onClick={hangUp}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid rgba(239,68,68,0.4)',
            background: 'rgba(239,68,68,0.15)',
            color: '#ea4335',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          📴 Colgar
        </button>
      </div>

      {Object.values(state.peers).map((p) => (
        <AudioPeer key={p.userId} stream={p.stream} />
      ))}
    </div>
  )
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<CallState>(callManager.getState())

  useEffect(() => {
    const unsub = callManager.subscribe((s) => {
      setState(s)
    })
    return () => { unsub() }
  }, [])

  useEffect(() => {
    if (user?.id && user?.alias) callManager.init(user.id, user.alias)
  }, [user?.id, user?.alias])

  const api: CallApi = {
    ...state,
    startCall: (callId, participants) => {
      callManager.startCall(callId, participants)
    },
    acceptCall: () => {
      callManager.acceptCall()
    },
    rejectCall: () => {
      callManager.rejectCall()
    },
    hangUp: () => {
      callManager.hangUp()
    },
    toggleMute: () => {
      callManager.toggleMute()
    },
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      <CallOverlay state={state} />
    </Ctx.Provider>
  )
}
