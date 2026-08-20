// Credenciales de Supabase ofuscadas (XOR + base64).
// Nota: es ofuscación, no cifrado real — el navegador necesita decodificar
// en runtime, así que esto NO es seguro contra análisis avanzado. La
// protección real de los datos es el RLS de Supabase.
const OBF_KEY = 'eph9x-supabase-internal'
const urlEnc = 'DQQcSQsXXFoRCRgQHgRdER4BEgsXEgAHEwZSCwMAAAAAAAAAAAMKAQ=='
const anonEnc = 'FhI3SQ1PHxwDCQMDHwByWAoYPDxfNyoIIh1WMR8hTDsXMgUCNHJZKwM3BwFVWA=='

function decode(enc: string): string {
  const raw = atob(enc)
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    out += String.fromCharCode(raw.charCodeAt(i) ^ OBF_KEY.charCodeAt(i % OBF_KEY.length))
  }
  return out
}

export const SUPABASE_URL = decode(urlEnc)
export const SUPABASE_ANON_KEY = decode(anonEnc)

// Llave pública VAPID para Web Push (es pública por diseño, no es un secreto)
export const VAPID_PUBLIC_KEY =
  'BGAffOyjwIKSN8us5OZ7Fiajci89t7Y0nwDFEX4bT54X38LiL_RZ_uOekC0mEoU1xRSC1JE8tjr58EaFjjvrW_4'
export const VAPID_SUBJECT = 'mailto:raulzoto64@gmail.com'