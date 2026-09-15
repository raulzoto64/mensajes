import { Capacitor } from '@capacitor/core'

export const isNative = () => false // Desactivar plugins nativos temporalmente - evita crash
export const getPlatform = () => Capacitor.getPlatform()

export function getServerUrl(): string | null {
  return import.meta.env.VITE_SERVER_URL || null
}
