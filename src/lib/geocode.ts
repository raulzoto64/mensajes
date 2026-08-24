// Geocodificación inversa (sin API key) usando Nominatim de OpenStreetMap.
// Devuelve el tipo de lugar (tienda/establecimiento/asentamiento humano),
// la dirección legible y, cuando OpenStreetMap los tenga, la manzana y el lote.

export type PlaceInfo = {
  displayName: string | null
  placeType: 'store' | 'establishment' | 'human_settlement' | 'building' | null
  address: string | null
  manzana: string | null
  lote: string | null
}

const SETTLEMENT = new Set([
  'neighbourhood', 'suburb', 'city', 'town', 'village', 'hamlet', 'municipality', 'county', 'quarter',
])

export async function reverseGeocode(lat: number, lng: number): Promise<PlaceInfo> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es&addressdetails=1`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const data = await res.json()
  const addr = (data.address as Record<string, any>) || {}

  let placeType: PlaceInfo['placeType'] = null
  const category = data.category as string | undefined
  const addresstype = data.addresstype as string | undefined
  if (category === 'shop') placeType = 'store'
  else if (category === 'amenity') placeType = 'establishment'
  else if (category === 'building') placeType = 'building'
  else if (addresstype && SETTLEMENT.has(addresstype)) placeType = 'human_settlement'

  const manzana = addr.block ?? addr.manzana ?? null
  const lote = addr.lot ?? addr.lote ?? null

  return {
    displayName: (data.display_name as string) || null,
    placeType,
    address: (data.display_name as string) || null,
    manzana: manzana ? String(manzana) : null,
    lote: lote ? String(lote) : null,
  }
}
