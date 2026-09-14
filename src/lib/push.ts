import { supabase } from './supabase'
import { VAPID_PUBLIC_KEY } from './config'
import { showToast } from '../components/Toast'
import { isNative } from './capacitor'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export async function subscribePush(userId: string): Promise<{ ok: boolean; error?: string }> {
  // En Android nativo, push nativo requiere Firebase configurado.
  // Lo deshabilitamos por ahora y usamos web push como fallback.
  if (isNative()) {
    const msg = 'push nativo deshabilitado (requiere Firebase)'
    console.log('[push]', msg)
    return { ok: false, error: msg }
  }

  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      const msg = 'push no soportado (sin serviceWorker/PushManager)'
      console.error('[push]', msg)
      showToast(msg)
      return { ok: false, error: msg }
    }
    if (Notification.permission !== 'granted') {
      const msg = `permiso de notificación: ${Notification.permission}`
      console.error('[push]', msg)
      showToast(msg)
      return { ok: false, error: msg }
    }
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }
    const json = sub.toJSON()
    if (!json.keys) {
      const msg = 'la suscripción no trae claves p256dh/auth'
      console.error('[push]', msg)
      showToast(msg)
      return { ok: false, error: msg }
    }
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          browser: navigator.userAgent || 'desconocido',
        },
        { onConflict: 'endpoint' },
      )
    if (error) {
      console.error('[push] upsert error', error)
      showToast(`push upsert: ${error.message}`)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (e) {
    const msg = `push exception: ${e instanceof Error ? e.message : String(e)}`
    console.error('[push]', msg)
    showToast(msg)
    return { ok: false, error: msg }
  }
}

export async function resubscribePush(userId: string): Promise<{ ok: boolean; error?: string }> {
  await unsubscribePush(userId)
  return await subscribePush(userId)
}

export async function unsubscribePush(userId: string): Promise<void> {
  if (!isNative()) {
    try {
      if (!('serviceWorker' in navigator)) return
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe().catch(() => {})
    } catch { /* ignore */ }
  }
  try {
    await supabase.from('push_subscriptions').delete().eq('user_id', userId)
  } catch { /* ignore */ }
}

export function standaloneMode(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true)
  )
}
