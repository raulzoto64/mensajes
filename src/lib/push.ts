import { supabase } from './supabase'
import { VAPID_PUBLIC_KEY } from './config'

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

function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

// Activa la suscripción de Web Push del dispositivo actual y la guarda en la BD.
// Idempotente: si ya hay una suscripción activa solo la re-graba.
// Devuelve { ok, error } para poder depurar por qué falla.
export async function subscribePush(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!pushSupported()) {
      const msg = 'push no soportado (sin serviceWorker/PushManager)'
      console.error('[push]', msg)
      return { ok: false, error: msg }
    }
    if (Notification.permission !== 'granted') {
      const msg = `permiso de notificación: ${Notification.permission}`
      console.error('[push]', msg)
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
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[push] excepción', e)
    return { ok: false, error: msg }
  }
}

// Fuerza una suscripción nueva con la clave VAPID actual: borra la suscripción
// local y la de la BD, y vuelve a crearlas. Útil cuando el push falla porque la
// suscripción fue creada con un par VAPID anterior.
export async function resubscribePush(userId: string): Promise<{ ok: boolean; error?: string }> {
  await unsubscribePush(userId)
  return await subscribePush(userId)
}

// Quita todas las suscripciones del usuario (por si se desloguea o desactiva).
export async function unsubscribePush(userId: string): Promise<void> {
  try {
    if (!pushSupported()) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe().catch(() => {})
    }
  } catch {
    /* ignore */
  }
  try {
    await supabase.from('push_subscriptions').delete().eq('user_id', userId)
  } catch {
    /* ignore */
  }
}

export function standaloneMode(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true)
  )
}