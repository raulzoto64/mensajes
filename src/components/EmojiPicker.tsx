type Props = {
  onInsert: (emoji: string) => void
  onSend: (emoji: string) => void
  onClose: () => void
  hasText: boolean
}

const EMOJI_GROUPS = [
  {
    label: 'Caras',
    emojis: ['😀','😂','🥹','😍','🥰','😎','🤩','😏','😒','😭','😤','🤬','😱','🤯','🥳','😴','🤫','🤔','🫡','🤗','😇','🥸'],
  },
  {
    label: 'Gestos',
    emojis: ['👍','👎','👏','🙌','🤝','🫶','❤️','🔥','💯','✨','🎉','💀','👀','🫣','🤌','🫰','🤙','☝️','🖕','💎','⚡','🌟'],
  },
  {
    label: 'Objetos',
    emojis: ['💬','📱','💻','🎵','🎮','🏆','🔮','🪄','🎭','🎨','📸','🎤','🎧','🚀','🛸','👾','🎲','🃏','🎯','🔑'],
  },
  {
    label: 'Animales',
    emojis: ['🐶','🐱','🦊','🐻','🐼','🦁','🐯','🦋','🐍','🦄','🐉','🦈','🐙','🦜','🐸','🦑'],
  },
]

export default function EmojiPicker({ onInsert, onSend, onClose, hasText }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '64px',
        left: '0',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        padding: '12px',
        width: '300px',
        maxHeight: '300px',
        overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        zIndex: 100,
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <span style={{ fontSize: '11px', color: '#8696a0', fontFamily: "'DM Mono', monospace" }}>EMOJIS</span>
          {!hasText && (
            <span style={{ fontSize: '11px', color: '#adb5bd', marginLeft: '8px' }}>· click = enviar como mensaje</span>
          )}
          {hasText && (
            <span style={{ fontSize: '11px', color: '#adb5bd', marginLeft: '8px' }}>· click = insertar en texto</span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#adb5bd', cursor: 'pointer', fontSize: '14px', padding: '2px 4px' }}
        >
          ✕
        </button>
      </div>
      {EMOJI_GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', color: '#adb5bd', marginBottom: '5px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
            {group.label.toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px' }}>
            {group.emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  if (hasText) onInsert(emoji)
                  else onSend(emoji)
                }}
                style={{
                  width: '34px',
                  height: '34px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '19px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f2f5')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
