import { isNative } from '../lib/capacitor'

type Tab = 'chats' | 'groups' | 'stories' | 'calls'

type Props = {
  active: Tab
  onTabChange: (tab: Tab) => void
  unreadChats: number
  unreadGroups: number
  storyCount: number
  missedCalls: number
}

export default function BottomNav({ active, onTabChange, unreadChats, unreadGroups, storyCount, missedCalls }: Props) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge: number }[] = [
    {
      id: 'chats',
      label: 'Chats',
      badge: unreadChats,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: 'groups',
      label: 'Grupos',
      badge: unreadGroups,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'stories',
      label: 'Historias',
      badge: storyCount,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="21.17" y1="8" x2="12" y2="8" />
          <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
          <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
        </svg>
      ),
    },
    {
      id: 'calls',
      label: 'Llamadas',
      badge: missedCalls,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      ),
    },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: isNative() ? '64px' : '60px',
        paddingBottom: isNative() ? 'env(safe-area-inset-bottom)' : '0',
        background: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 100,
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              padding: '6px 16px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              color: isActive ? '#00a884' : '#8696a0',
              transition: 'color 0.2s',
              minWidth: '64px',
            }}
          >
            <div style={{ position: 'relative' }}>
              {tab.icon}
              {tab.badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    minWidth: '18px',
                    height: '18px',
                    background: '#00a884',
                    borderRadius: '9px',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    border: '2px solid #ffffff',
                  }}
                >
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: isActive ? '600' : '400',
                letterSpacing: '0.02em',
              }}
            >
              {tab.label}
            </span>
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  top: '-1px',
                  left: '20%',
                  right: '20%',
                  height: '2px',
                  background: '#00a884',
                  borderRadius: '1px',
                }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
