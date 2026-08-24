import { supabase } from './supabase'
import { reverseGeocode } from './geocode'

let watchId: number | null = null
let dwellTimer: ReturnType<typeof setInterval> | null = null
let userId: string | null = null

// Solo cuenta como "nueva dirección guardada" si se aleja más de esto de la última.
const MOVE_THRESHOLD_M = 20
// Y solo se guarda si el usuario permanece ahí al menos esta cantidad de tiempo.
const DWELL_MS = 60 * 60 * 1000 // 1 hora
const DWELL_CHECK_MS = 60 * 1000 // revisamos cada minuto

// Posición "en vivo": se actualiza seguido para ver el movimiento en tiempo real,
// pero NO se guarda como dirección (no crea historial).
const LIVE_INTERVAL_MS = 15 * 1000 // la enviamos cada 15 s como máximo
const LIVE_MIN_MOVE_M = 3 // y solo si se movió al menos 3 m

// Candidata: lugar donde el usuario está ahora y que podría guardarse como dirección.
let candidate: { lat: number; lng: number; accuracy: number | null; startTs: number } | null = null
// Última dirección YA guardada (para comparar la distancia mínima de 20 m).
let lastSaved: { lat: number; lng: number } | null = null
// Última posición "en vivo" enviada a la base de datos.
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

  // Geocodificación inversa (mejor esfuerzo).
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

  // La primera (ubicación de registro) se guarda de inmediato; el resto esperan la estancia.
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

// Inicia el seguimiento en tiempo real de la ubicación del usuario.
export async function startLiveLocation(uid: string): Promise<void> {
  if (watchId !== null) return
  if (typeof navigator === 'undefined' || !navigator.geolocation) return
  userId = uid

  // Cargamos la última dirección guardada para no volver a registrar el mismo sitio.
  try {
    const { data } = await supabase
      .from('user_locations')
      .select('lat, lng')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
    if (data && data.length > 0) lastSaved = { lat: data[0].lat, lng: data[0].lng }
  } catch {
    /* ignore */
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords
      const now = Date.now()

      // 1) Posición "en vivo": se actualiza seguido para ver el movimiento real.
      const moved = lastLive ? haversine(lastLive.lat, lastLive.lng, latitude, longitude) : Infinity
      if (now - (lastLive?.ts ?? 0) >= LIVE_INTERVAL_MS && moved >= LIVE_MIN_MOVE_M) {
        lastLive = { lat: latitude, lng: longitude, ts: now }
        pushLive(latitude, longitude, accuracy ?? null)
      }

      // 2) Dirección guardada: regla de >20 m y estancia >1 h.
      if (candidate === null) {
        if (lastSaved === null) {
          // Ubicación de registro: se guarda de inmediato.
          candidate = { lat: latitude, lng: longitude, accuracy: accuracy ?? null, startTs: now }
          lastSaved = { lat: 0, lng: 0 } // optimista: evita dobles guardados
          lastSaved = { lat: latitude, lng: longitude }
          saveCandidate()
          return
        }
        if (haversine(lastSaved.lat, lastSaved.lng, latitude, longitude) >= MOVE_THRESHOLD_M) {
          candidate = { lat: latitude, lng: longitude, accuracy: accuracy ?? null, startTs: now }
        }
        return
      }

      // Ya hay un candidato: ¿sigue en el mismo sitio?
      if (haversine(candidate.lat, candidate.lng, latitude, longitude) < MOVE_THRESHOLD_M) return

      // Se movió del candidato: si volvió cerca de la última guardada, descartamos;
      // si no, arrancamos un candidato nuevo desde esta posición.
      if (lastSaved && haversine(lastSaved.lat, lastSaved.lng, latitude, longitude) < MOVE_THRESHOLD_M) {
        candidate = null
      } else {
        candidate = { lat: latitude, lng: longitude, accuracy: accuracy ?? null, startTs: now }
      }
    },
    (err) => console.error('[liveLocation] watch error', err),
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
  )

  dwellTimer = setInterval(checkDwell, DWELL_CHECK_MS)
}

export function stopLiveLocation(): void {
  if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId)
  }
  if (dwellTimer !== null) clearInterval(dwellTimer)
  watchId = null
  dwellTimer = null
  candidate = null
  lastSaved = null
  lastLive = null
  userId = null
}
