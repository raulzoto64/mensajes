import { supabase } from './supabase'
import { reverseGeocode } from './geocode'
import { showToast } from '../components/Toast'
import { isNative } from './capacitor'

let watchId: number | null = null
let capacitorWatchHandle: string | null = null
let dwellTimer: ReturnType<typeof setInterval> | null = null
let userId: string | null = null

const MOVE_THRESHOLD_M = 20
const DWELL_MS = 60 * 60 * 1000
const DWELL_CHECK_MS = 60 * 1000
const LIVE_INTERVAL_MS = 15 * 1000
const LIVE_MIN_MOVE_M = 3

let candidate: { lat: number; lng: number; accuracy: number | null; startTs: number } | null = null
let lastSaved: { lat: number; lng: number } | null = null
let lastLive: { lat: number; lng: number; ts: number } | null = null

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const la1 = (aLat * Math.PI) / 180
  const la2 = (bLat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

async function saveCandidate() {
  if (!candidate || !userId) return
  const { lat, lng, accuracy } = candidate

  let placeType: string | null = null
  let address: string | null = null
  let manzana: string | null = null
  let lote: string | null = null
  try {
    const info = await reverseGeocode(lat, lng)
    placeType = info.placeType
    address = info.address
    manzana = info.manzana
    lote = info.lote
  } catch (ge) {
    console.error('[liveLocation] geocode error', ge)
  }

  const isInitial = lastSaved === null

  supabase
    .from('user_locations')
    .insert({
      user_id: userId,
      lat,
      lng,
      accuracy: accuracy ?? null,
      is_initial: isInitial,
      is_registration: isInitial,
      place_type: placeType,
      address,
      manzana,
      lote,
    })
    .then(
      () => {
        lastSaved = { lat, lng }
        candidate = null
      },
      (e: any) => console.error('[liveLocation] insert error', e),
    )
}

function checkDwell() {
  if (!candidate) return
  if (Date.now() - candidate.startTs >= DWELL_MS) saveCandidate()
}

function handlePosition(latitude: number, longitude: number, accuracy: number | null) {
  const now = Date.now()

  const moved = lastLive ? haversine(lastLive.lat, lastLive.lng, latitude, longitude) : Infinity
  if (now - (lastLive?.ts ?? 0) >= LIVE_INTERVAL_MS && moved >= LIVE_MIN_MOVE_M) {
    lastLive = { lat: latitude, lng: longitude, ts: now }
    pushLive(latitude, longitude, accuracy)
  }

  if (candidate === null) {
    if (lastSaved === null) {
      candidate = { lat: latitude, lng: longitude, accuracy, startTs: now }
      lastSaved = { lat: latitude, lng: longitude }
      saveCandidate()
      return
    }
    if (haversine(lastSaved.lat, lastSaved.lng, latitude, longitude) >= MOVE_THRESHOLD_M) {
      candidate = { lat: latitude, lng: longitude, accuracy, startTs: now }
    }
    return
  }

  if (haversine(candidate.lat, candidate.lng, latitude, longitude) < MOVE_THRESHOLD_M) return

  if (lastSaved && haversine(lastSaved.lat, lastSaved.lng, latitude, longitude) < MOVE_THRESHOLD_M) {
    candidate = null
  } else {
    candidate = { lat: latitude, lng: longitude, accuracy, startTs: now }
  }
}

async function pushLive(lat: number, lng: number, accuracy: number | null) {
  if (!userId) return
  supabase
    .from('user_live')
    .upsert({ user_id: userId, lat, lng, accuracy: accuracy ?? null, at: new Date().toISOString() })
    .then(
      () => {},
      (e: any) => console.error('[liveLocation] live upsert error', e),
    )
}

// ── Native (Capacitor) geolocation ───────────────────────────────────
async function startNativeLocation(uid: string): Promise<void> {
  if (capacitorWatchHandle !== null) return
  const { Geolocation } = await import('@capacitor/geolocation')

  const perm = await Geolocation.requestPermissions()
  if (perm.location !== 'granted') {
    const msg = `permiso ubicación nativo: ${perm.location}`
    console.error('[liveLocation]', msg)
    showToast(msg)
    return
  }

  // Load last saved location
  try {
    const { data } = await supabase
      .from('user_locations')
      .select('lat, lng')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
    if (data && data.length > 0) lastSaved = { lat: data[0].lat, lng: data[0].lng }
  } catch { /* ignore */ }

  capacitorWatchHandle = await Geolocation.watchPosition(
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    (pos) => {
      if (pos) handlePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? null)
    },
  )
}

function stopNativeLocation() {
  if (capacitorWatchHandle !== null) {
    import('@capacitor/geolocation').then(({ Geolocation }) => {
      Geolocation.clearWatch({ id: capacitorWatchHandle! })
      capacitorWatchHandle = null
    })
  }
}

// ── Web geolocation ──────────────────────────────────────────────────
function startWebLocation(uid: string) {
  if (watchId !== null) return
  if (typeof navigator === 'undefined' || !navigator.geolocation) return

  watchId = navigator.geolocation.watchPosition(
    (pos) => handlePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? null),
    (err) => {
      const msg = `geolocation error [${err.code}]: ${err.message}`
      console.error('[liveLocation]', msg)
      showToast(msg)
    },
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
  )
}

function stopWebLocation() {
  if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId)
  }
  watchId = null
}

// ── Public API ───────────────────────────────────────────────────────
export async function startLiveLocation(uid: string): Promise<void> {
  if (watchId !== null || capacitorWatchHandle !== null) return
  userId = uid
  dwellTimer = setInterval(checkDwell, DWELL_CHECK_MS)

  if (isNative()) {
    await startNativeLocation(uid)
  } else {
    // Load last saved location for web too
    try {
      const { data } = await supabase
        .from('user_locations')
        .select('lat, lng')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
      if (data && data.length > 0) lastSaved = { lat: data[0].lat, lng: data[0].lng }
    } catch { /* ignore */ }
    startWebLocation(uid)
  }
}

export function stopLiveLocation(): void {
  if (isNative()) {
    stopNativeLocation()
  } else {
    stopWebLocation()
  }
  if (dwellTimer !== null) clearInterval(dwellTimer)
  dwellTimer = null
  candidate = null
  lastSaved = null
  lastLive = null
  userId = null
}
