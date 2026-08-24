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
  'BEf5JRyAOcpsGaGGY8k9y_i7RcjzgJZ_Q7-MKKmaF_PL-Itg7JueNjFKQyRbtVv3isnrKB1jPc6wWOhMGVTxtMM'
export const VAPID_SUBJECT = 'mailto:raulzoto64@gmail.com'

// Secreto compartido entre el trigger (SQL) y la Edge Function send-push.
// Ya está en el repositorio (en push_trigger.sql), así que no es un secreto crítico.
export const PUSH_SECRET = '5035b8b60e38488e30e635a4754a4eb06c1f6d8a350964723d8432ed4c6e3cd8'