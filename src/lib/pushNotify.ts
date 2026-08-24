import { supabase } from './supabase'
import { PUSH_SECRET } from './config'

type MessagePush = {
  table: 'messages' | 'direct_messages'
  id: string
  sender_id: string
  conversation_id?: string | null
  group_id?: string | null
  type: string
  content?: string | null
  media_url?: string | null
}

// Dispara un push vía la Edge Function send-push. La función resuelve los
// destinatarios (el otro participante del DM, o los miembros del grupo menos
// el remitente) y envía la notificación a sus suscripciones push.
export async function triggerMessagePush(p: MessagePush): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', {
      body: {
        table: p.table,
        id: p.id,
        sender_id: p.sender_id,
        conversation_id: p.conversation_id ?? null,
        group_id: p.group_id ?? null,
        type: p.type,
        content: p.content ?? null,
        media_url: p.media_url ?? null,
      },
      headers: { 'x-push-secret': PUSH_SECRET },
    })
  } catch (e) {
    console.error('[push] trigger mensaje falló', e)
  }
}

// Avisa a los administradores cuando un nuevo usuario queda pendiente de aprobación.
// Resuelve los admins en el cliente y usa el modo self_test (user_id) de la función
// desplegada, que no requiere redeploy para soportar este caso.
export async function triggerNewUserPush(userAlias: string, userId: string): Promise<void> {
  try {
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('is_admin', true)
    for (const a of admins ?? []) {
      await supabase.functions.invoke('send-push', {
        body: {
          self_test: true,
          user_id: a.id,
          title: 'Nuevo usuario pendiente',
          body: `@${userAlias} solicita ingreso y espera tu aprobación`,
          url: '/?admin=1',
        },
        headers: { 'x-push-secret': PUSH_SECRET },
      })
    }
  } catch (e) {
    console.error('[push] trigger nuevo usuario falló', e)
  }
}
