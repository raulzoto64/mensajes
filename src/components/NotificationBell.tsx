import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  userId?: string
  onGoToChat?: (groupId?: string, dmId?: string) => void
}

export default function NotificationBell({ userId, onGoToChat }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<{ id: string; title: string; url: string; count: number; messageId: string; isGroup: boolean }[]>([])

  async function load() {
    if (!userId) return
    // Simple fetch of unread messages count for display
    const { data: groupMsgs } = await supabase
      .from('messages')
      .select('id, group_id')
      .eq('is_deleted', false)
    const { data: dmMsgs } = await supabase
      .from('direct_messages')
      .select('id, conversation_id')
      .eq('is_deleted', false)
    const groups = (groupMsgs ?? []).map((m: any) => ({ id: `g-${m.group_id}`, title: 'Grupo', url: `/?grupo=${m.group_id}`, count: 1, messageId: m.id, isGroup: true }))
    const dms = (dmMsgs ?? []).map((m: any) => ({ id: `dm-${m.conversation_id}`, title: 'Mensaje', url: `/?dm=${m.conversation_id}`, count: 1, messageId: m.id, isGroup: false }))
    setItems([...groups, ...dms].slice(0, 5))
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(!open); if (!open) load() }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '4px', color: '#00a884' }}
        title="Notificaciones"
      >
        🔔
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: '36px', right: 0,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
            width: '240px', padding: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            zIndex: 200, fontFamily: "'Outfit', sans-serif",
          }}
        >
          <div style={{ fontSize: '11px', color: '#8696a0', fontWeight: '700', marginBottom: '6px' }}>NOTIFICACIONES</div>
          {items.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#adb5bd', padding: '8px 0' }}>Sin notificaciones nuevas</div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={async () => {
                  const itemData = items.find(n => n.id === item.id)
                  if (!itemData || !userId) return
                  // 1. Filtrar/eliminar del estado local inmediatamente
                  const updated = items.filter(n => n.id !== item.id);
                  setItems(updated);
                  // 2. Si la lista queda vacía, cerrar el modal
                  if (updated.length === 0) setOpen(false);
                  // 3. Marcar como visto en la base de datos (Opción B: vistas)
                  try {
                    if (itemData.isGroup) {
                      await supabase.from('message_views').upsert({ message_id: itemData.messageId, user_id: userId, group_id: itemData.url.match(/grupo=([^&]+)/)?.[1] || '' }).select().single()
                    } else {
                      await supabase.from('direct_message_views').upsert({ message_id: itemData.messageId, user_id: userId, conversation_id: itemData.url.match(/dm=([^&]+)/)?.[1] || '' }).select().single()
                    }
                  } catch (e) {
                    console.error('Error al marcar notificación como vista:', e)
                  }
                  // 4. Navegar al chat
                  if (onGoToChat) {
                    const groupMatch = item.url.match(/grupo=([^&]+)/)
                    const dmMatch = item.url.match(/dm=([^&]+)/)
                    if (groupMatch) onGoToChat(groupMatch[1])
                    else if (dmMatch) onGoToChat(undefined, dmMatch[1])
                  }
                }}
                style={{ width: '100%', textAlign: 'left', padding: '8px', border: 'none', background: '#e8f5e9', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#00695c', fontWeight: '600', fontFamily: "'Outfit', sans-serif", borderLeft: '4px solid #00a884' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f2f5')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {item.title} · {item.count}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
