import { supabase } from './supabase'
import { reverseGeocode } from './geocode'

let watchId: number | null = null
let last: { lat: number; lng: number; ts: number } | null = null

// No insertamos si la posición apenas se movió: evita filas duplicadas
// cuando el usuario se queda quieto en el mismo sitio.
const MOVE_THRESHOLD_M = 50

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const la1 = (aLat * Math.PI) / 180
  const la2 = (bLat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Inicia el seguimiento en tiempo real de la ubicación del usuario.
// Solo inserta en user_locations cuando la posición cambia más de
// MOVE_THRESHOLD_M; si se queda en el mismo lugar, no actualiza.
export function startLiveLocation(userId: string): void {
  if (watchId !== null) return
  if (typeof navigator === 'undefined' || !navigator.geolocation) return
  watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords
      const now = Date.now()
      if (last) {
        const d = haversine(last.lat, last.lng, latitude, longitude)
        if (d < MOVE_THRESHOLD_M) return
      }
      // Marcamos como "posición inicial" la primera de este usuario.
      let isInitial = false
      try {
        const { count } = await supabase
          .from('user_locations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
        isInitial = (count ?? 0) === 0
      } catch {
        /* ignore */
      }

      // Geocodificación inversa (mejor esfuerzo, no bloquea el guardado).
      let placeType: string | null = null
      let address: string | null = null
      let manzana: string | null = null
      let lote: string | null = null
      try {
        const info = await reverseGeocode(latitude, longitude)
        placeType = info.placeType
        address = info.address
        manzana = info.manzana
        lote = info.lote
      } catch (ge) {
        console.error('[liveLocation] geocode error', ge)
      }

      last = { lat: latitude, lng: longitude, ts: now }
      supabase
        .from('user_locations')
        .insert({
          user_id: userId,
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ?? null,
          is_initial: isInitial,
          place_type: placeType,
          address: address,
          manzana: manzana,
          lote: lote,
        })
        .then(
          () => {},
          (e: any) => console.error('[liveLocation] insert error', e),
        )
    },
    (err) => console.error('[liveLocation] watch error', err),
    { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 },
  )
}

export function stopLiveLocation(): void {
  if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId)
  }
  watchId = null
  last = null
}
