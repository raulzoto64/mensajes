export function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const diff = Math.max(0, Date.now() - t)
  const sec = Math.floor(diff / 1000)
  const min = Math.floor(sec / 60)
  const h = Math.floor(min / 60)
  const d = Math.floor(h / 24)

  if (sec < 60) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  if (h < 24) return `hace ${h} h`
  if (d < 7) return `hace ${d} día${d !== 1 ? 's' : ''}`
  const w = Math.floor(d / 7)
  if (w < 5) return `hace ${w} sem`
  const m = Math.floor(d / 30)
  if (m < 12) return `hace ${m} mes${m !== 1 ? 'es' : ''}`
  const y = Math.floor(d / 365)
  return `hace ${y} año${y !== 1 ? 's' : ''}`
}

export function lastSeenLabel(iso: string | null | undefined): string {
  const rel = timeAgo(iso)
  return rel ? `Últ. vez ${rel}` : 'Desconectado'
}