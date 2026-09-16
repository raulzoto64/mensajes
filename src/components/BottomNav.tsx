import { isNative } from '../lib/capacitor'

type Tab = 'chats' | 'groups' | 'stories' | 'calls' | 'contacts'

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
      id: 'chats', label: 'Chats', badge: unreadChats,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: 'groups', label: 'Grupos', badge: unreadGroups,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'stories', label: 'Historias', badge: storyCount,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ),
    },
    {
      id: 'calls', label: 'Llamadas', badge: missedCalls,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      ),
    },
    {
      id: 'contacts', label: 'Contactos', badge: 0,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ]

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        minHeight: '72px',
        height: 'auto',
        paddingTop: '10px',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #E9ECEF',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
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
              justifyContent: 'center',
              flex: 1,
              height: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? '#008069' : '#54656F',
              transition: 'color 0.15s',
            }}
          >
            <div
              style={{
                width: isActive ? '68px' : 'auto',
                height: isActive ? '44px' : 'auto',
                borderRadius: isActive ? '16px' : '0px',
                backgroundColor: isActive ? '#D3F2C7' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isActive ? '0 12px' : '0',
              }}
            >
              <div style={{ position: 'relative', width: isActive ? '22px' : 'auto', height: isActive ? '22px' : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ display: 'inline-flex' }}>{tab.icon}</span>
                {tab.badge > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-10px',
                      minWidth: '18px',
                      height: '18px',
                      background: '#25D366',
                      borderRadius: '9px',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      border: '2px solid #F8F9FA',
                    }}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
            </div>
            <span
              style={{
                fontSize: '12px',
                marginTop: '4px',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? '#008069' : '#54656F',
                letterSpacing: '0.01em',
              }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
