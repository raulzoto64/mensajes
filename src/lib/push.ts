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

// ── Native (Capacitor) push ──────────────────────────────────────────
async function subscribePushNative(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const mod = await import('@capacitor/push-notifications')
    const PushNotifications = mod.PushNotifications
    if (!PushNotifications) {
      const msg = 'PushNotifications plugin no disponible'
      console.error('[push]', msg)
      showToast(msg)
      return { ok: false, error: msg }
    }

    let perm
    try {
      perm = await PushNotifications.requestPermissions()
    } catch (e) {
      const msg = `error al pedir permiso push: ${e instanceof Error ? e.message : String(e)}`
      console.error('[push]', msg)
      showToast(msg)
      return { ok: false, error: msg }
    }

    if (perm.receive !== 'granted') {
      const msg = `permiso push nativo: ${perm.receive}`
      console.error('[push]', msg)
      showToast(msg)
      return { ok: false, error: msg }
    }

    try {
      await PushNotifications.register()
    } catch (e) {
      const msg = `error al registrar push: ${e instanceof Error ? e.message : String(e)}`
      console.error('[push]', msg)
      showToast(msg)
      return { ok: false, error: msg }
    }

    return new Promise((resolve) => {
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          const msg = 'push registration timeout (10s)'
          console.error('[push]', msg)
          showToast(msg)
          resolve({ ok: false, error: msg })
        }
      }, 10000)

      PushNotifications.addListener('registration', async (token) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        console.log('[push] FCM token', token.value)
        const { error } = await supabase
          .from('push_subscriptions')
          .upsert(
            {
              user_id: userId,
              endpoint: token.value,
              p256dh: '',
              auth: '',
              browser: 'capacitor-native',
            },
            { onConflict: 'endpoint' },
          )
        if (error) {
          console.error('[push] upsert error', error)
          showToast(`push upsert: ${error.message}`)
          resolve({ ok: false, error: error.message })
        } else {
          resolve({ ok: true })
        }
      })

      PushNotifications.addListener('registrationError', (err) => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        const msg = `push registration error: ${JSON.stringify(err)}`
        console.error('[push]', msg)
        showToast(msg)
        resolve({ ok: false, error: msg })
      })
    })
  } catch (e) {
    const msg = `push native exception: ${e instanceof Error ? e.message : String(e)}`
    console.error('[push]', msg)
    showToast(msg)
    return { ok: false, error: msg }
  }
}

// ── Web push (service worker) ────────────────────────────────────────
async function subscribePushWeb(userId: string): Promise<{ ok: boolean; error?: string }> {
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

// ── Public API ───────────────────────────────────────────────────────
export async function subscribePush(userId: string): Promise<{ ok: boolean; error?: string }> {
  return isNative() ? subscribePushNative(userId) : subscribePushWeb(userId)
}

export async function resubscribePush(userId: string): Promise<{ ok: boolean; error?: string }> {
  await unsubscribePush(userId)
  return await subscribePush(userId)
}

export async function unsubscribePush(userId: string): Promise<void> {
  if (isNative()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      await PushNotifications.removeAllListeners()
    } catch { /* ignore */ }
  } else {
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
