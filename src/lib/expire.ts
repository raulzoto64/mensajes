// Opciones de duración de borrado automático (en horas).
// Usadas para configurar grupos y chats individuales.
export const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 24, label: '24 horas' },
  { value: 48, label: '48 horas' },
  { value: 168, label: '1 semana' },
  { value: 360, label: '15 días' },
  { value: 720, label: '1 mes' },
]

// Devuelve el corte (timestamp) a partir del cual un mensaje se considera expirado.
export function expiryCutoff(autoDeleteHours: number | null | undefined): number {
  const hours = autoDeleteHours && autoDeleteHours > 0 ? autoDeleteHours : 24
  return Date.now() - hours * 60 * 60 * 1000
}

export function durationLabel(hours: number | null | undefined): string {
  const value = hours && hours > 0 ? hours : 24
  const opt = DURATION_OPTIONS.find((o) => o.value === value)
  return opt ? opt.label : `${value} horas`
}
