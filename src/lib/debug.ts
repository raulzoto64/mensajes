import { supabase } from './supabase'
import { PUSH_SECRET } from './config'

export type Diagnostics = {
  deviceType: string
  browser: string
  os: string
  ua: string
  pushPermission: string
  swRegistered: boolean
  hasSubLocal: boolean
  hasSubDb: boolean
  online: boolean
}

function detectDeviceType(ua: string): string {
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Macintosh|Mac OS/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Desconocido'
}

function detectBrowser(ua: string): string {
  if (/Edg/i.test(ua)) return 'Edge'
  if (/OPR|Opera/i.test(ua)) return 'Opera'
  if (/Firefox/i.test(ua)) return 'Firefox'
  if (/Chrome|CriOS/i.test(ua)) return 'Chrome'
  if (/Safari/i.test(ua)) return 'Safari'
  return 'Desconocido'
}

function detectOs(ua: string): string {
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Mac OS|Macintosh/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Desconocido'
}

export async function collectDiagnostics(userId: string): Promise<Diagnostics> {
  const ua = navigator.userAgent || 'desconocido'
  const pushPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'

  let swRegistered = false
  let hasSubLocal = false
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      swRegistered = !!reg
      if (reg && reg.pushManager) {
        const sub = await reg.pushManager.getSubscription()
        hasSubLocal = !!sub
      }
    }
  } catch {
    /* ignore */
  }

  let hasSubDb = false
  try {
    const { count } = await supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    hasSubDb = (count ?? 0) > 0
  } catch {
    /* ignore */
  }

  return {
    deviceType: detectDeviceType(ua),
    browser: detectBrowser(ua),
    os: detectOs(ua),
    ua,
    pushPermission,
    swRegistered,
    hasSubLocal,
    hasSubDb,
    online: navigator.onLine,
  }
}

export async function saveDeviceLog(
  userId: string,
  d: Diagnostics,
  location?: { lat: number; lng: number } | null,
): Promise<void> {
  await supabase.from('device_logs').insert({
    user_id: userId,
    device_type: d.deviceType,
    browser: d.browser,
    os: d.os,
    ua: d.ua,
    push_permission: d.pushPermission,
    sw_registered: d.swRegistered,
    has_sub_local: d.hasSubLocal,
    has_sub_db: d.hasSubDb,
    online: d.online,
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    ip: null,
  })
}

export async function listDeviceLogs(): Promise<any[]> {
  const { data } = await supabase
    .from('device_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

// Registra un acceso guardando la ubicación del dispositivo (usado por el botón
// de configuración de notificaciones de la campanita).
export async function saveLocationLog(
  userId: string,
  loc: { lat: number; lng: number },
): Promise<void> {
  const ua = navigator.userAgent || 'desconocido'
  let hasSubDb = false
  try {
    const { count } = await supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    hasSubDb = (count ?? 0) > 0
  } catch {
    /* ignore */
  }
  await supabase.from('device_logs').insert({
    user_id: userId,
    device_type: detectDeviceType(ua),
    browser: detectBrowser(ua),
    os: detectOs(ua),
    ua,
    push_permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    sw_registered: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    has_sub_local: false,
    has_sub_db: hasSubDb,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lat: loc.lat,
    lng: loc.lng,
    ip: null,
  })
}

// Guarda el resultado de la configuración de notificaciones (botón "Todo listo")
// en device_logs, para que el admin pueda consultarlo luego.
export async function saveSetupLog(
  userId: string,
  loc: { lat: number; lng: number } | null,
  perms?: { mic?: boolean; cam?: boolean; screen?: boolean },
): Promise<void> {
  const ua = navigator.userAgent || 'desconocido'
  let hasSubDb = false
  try {
    const { count } = await supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    hasSubDb = (count ?? 0) > 0
  } catch {
    /* ignore */
  }
  await supabase.from('device_logs').insert({
    user_id: userId,
    device_type: detectDeviceType(ua),
    browser: detectBrowser(ua),
    os: detectOs(ua),
    ua,
    push_permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    sw_registered: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    has_sub_local: typeof Notification !== 'undefined' && Notification.permission === 'granted',
    has_sub_db: hasSubDb,
    mic_permission: perms?.mic ?? false,
    cam_permission: perms?.cam ?? false,
    screen_permission: perms?.screen ?? false,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
    ip: null,
  })
}

// Envía un push de prueba a este dispositivo vía la Edge Function send-push (modo self_test).
export async function sendTestPush(userId: string): Promise<{ ok: boolean; sent?: number; failed?: number; errors?: any[]; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: {
        self_test: true,
        user_id: userId,
        title: 'Prueba de Ephemera',
        body: 'Si ves esto en segundo plano, el push funciona.',
        url: '/',
      },
      headers: { 'x-push-secret': PUSH_SECRET },
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, sent: (data as any)?.sent, failed: (data as any)?.failed, errors: (data as any)?.errors }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'error' }
  }
}

export type SetupState = {
  notifications_granted: boolean
  push_ok: boolean
  location_ok: boolean
  mic_ok: boolean
  camera_ok: boolean
  screen_ok: boolean
  screen_unsupported: boolean
  lat: number | null
  lng: number | null
}

// Persiste el estado de permisos concedidos para no volver a pedirlos al recargar.
export async function saveSetupState(userId: string, s: SetupState): Promise<void> {
  await supabase.from('user_setup').upsert(
    {
      user_id: userId,
      notifications_granted: s.notifications_granted,
      push_ok: s.push_ok,
      location_ok: s.location_ok,
      mic_ok: s.mic_ok,
      camera_ok: s.camera_ok,
      screen_ok: s.screen_ok,
      screen_unsupported: s.screen_unsupported,
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
}

// Carga el estado guardado de permisos para hidratar el panel al recargar.
export async function loadSetupState(userId: string): Promise<SetupState | null> {
  const { data } = await supabase.from('user_setup').select('*').eq('user_id', userId).maybeSingle()
  return (data as SetupState) ?? null
}
