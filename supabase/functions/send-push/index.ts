// EPHEMERA — Edge Function `send-push`
// Cópialo en Supabase Dashboard → Edge Functions → Create a new function
// (nombre: send-push) y pega este archivo en el editor.
//
// Secrets requeridos (Settings → Edge Functions → Secrets):
//   PUSH_SECRET         = 5035b8b60e38488e30e635a4754a4eb06c1f6d8a350964723d8432ed4c6e3cd8
//   VAPID_PRIVATE_KEY   = iRLSVnZ3fphB8txNVovLG997mxn4AMrpol9j36yhKXk
//   VAPID_PUBLIC_KEY    = BGAffOyjwIKSN8us5OZ7Fiajci89t7Y0nwDFEX4bT54X38LiL_RZ_uOekC0mEoU1xRSC1JE8tjr58EaFjjvrW_4
//   VAPID_SUBJECT       = mailto:raulzoto64@gmail.com

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PUSH_SECRET = Deno.env.get('PUSH_SECRET') || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:raulzoto64@gmail.com'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

type Payload = {
  table: string
  id: string
  sender_id: string
  group_id: string | null
  conversation_id: string | null
  type: string
  content: string | null
  media_url: string | null
}

async function resolveRecipients(p: Payload) {
  if (p.table === 'messages' && p.group_id) {
    const { data: group } = await admin
      .from('groups')
      .select('name')
      .eq('id', p.group_id)
      .maybeSingle()
    const { data: members } = await admin
      .from('group_members')
      .select('user_id')
      .eq('group_id', p.group_id)
    const userIds = (members ?? []).map((m) => m.user_id).filter((id) => id !== p.sender_id)
    return { userIds, title: group?.name ?? 'Grupo', url: `/?grupo=${p.group_id}` }
  }
  if (p.table === 'direct_messages' && p.conversation_id) {
    const { data: conv } = await admin
      .from('direct_conversations')
      .select('user_a, user_b')
      .eq('id', p.conversation_id)
      .maybeSingle()
    if (!conv) return null
    const userIds = [conv.user_a, conv.user_b].filter((id) => id !== p.sender_id)
    const { data: sender } = await admin
      .from('users')
      .select('alias')
      .eq('id', p.sender_id)
      .maybeSingle()
    const otherId = userIds[0]
    const alias = encodeURIComponent(sender?.alias ?? 'usuario')
    return { userIds, title: sender?.alias ?? 'Nuevo mensaje', url: `/?dm=${p.conversation_id}&u=${otherId}&alias=${alias}` }
  }
  return null
}

function previewBody(p: Payload) {
  if (p.type === 'text' && p.content) return p.content.slice(0, 160)
  const labels: Record<string, string> = {
    audio: '🎤 Envió un audio',
    video: '🎬 Envió un video',
    image: '🖼️ Envió una imagen',
    gif: '🎞️ Envió un GIF',
    emoji: '😀 Envió un emoji',
  }
  return labels[p.type] || 'Nuevo mensaje'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204 })
  }
  if (req.headers.get('x-push-secret') !== PUSH_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 })
  }

  const target = await resolveRecipients(payload)
  if (!target || target.userIds.length === 0) {
    return Response.json({ ok: true, skipped: true })
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', target.userIds)

  const body = previewBody(payload)
  const notificationPayload = JSON.stringify({
    title: target.title,
    body,
    url: target.url,
    tag: payload.table === 'messages' ? `g-${payload.group_id}` : `dm-${payload.conversation_id}`,
    vibrate: [120, 60, 120],
  })

  let sent = 0
  let failed = 0
  for (const sub of subs ?? []) {
    try {
      const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }
      await webpush.sendNotification(pushSub, notificationPayload, { TTL: 86400 })
      sent++
    } catch (err) {
      failed++
      // 404/410 → suscripción vencida, la borramos
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }

  return Response.json({ ok: true, sent, failed })
})