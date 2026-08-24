import { supabase } from './supabase'
import { reverseGeocode } from './geocode'

let watchId: number | null = null
let dwellTimer: ReturnType<typeof setInterval> | null = null
let userId: string | null = null

// Solo cuenta como "nueva ubicación" si se aleja más de esto de la última guardada.
const MOVE_THRESHOLD_M = 20
// Y solo se guarda si el usuario permanece ahí al menos esta cantidad de tiempo.
const DWELL_MS = 60 * 60 * 1000 // 1 hora
const DWELL_CHECK_MS = 60 * 1000 // revisamos cada minuto

// Candidata: lugar donde el usuario está ahora mismo y que podría guardarse.
let candidate: { lat: number; lng: number; accuracy: number | null; startTs: number } | null = null
// Última ubicación YA guardada (para comparar la distancia mínima de 20 m).
let lastSaved: { lat: number; lng: number } | null = null

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

  const isInitial = lastSaved === null

  supabase
    .from('user_locations')
    .insert({
      user_id: userId,
      lat,
      lng,
      accuracy: accuracy ?? null,
      is_initial: isInitial,
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

// Inicia el seguimiento en tiempo real de la ubicación del usuario.
// Regla: se guarda una NUEVA ubicación solo si está a más de 20 m de la última
// guardada Y el usuario permanece ahí más de 1 hora.
export async function startLiveLocation(uid: string): Promise<void> {
  if (watchId !== null) return
  if (typeof navigator === 'undefined' || !navigator.geolocation) return
  userId = uid

  // Cargamos la última ubicación guardada para no volver a registrar el mismo sitio.
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

      if (candidate === null) {
        if (lastSaved === null) {
          candidate = { lat: latitude, lng: longitude, accuracy: accuracy ?? null, startTs: now }
        } else if (haversine(lastSaved.lat, lastSaved.lng, latitude, longitude) >= MOVE_THRESHOLD_M) {
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
    { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 },
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
  userId = null
}
