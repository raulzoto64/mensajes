import { Capacitor } from '@capacitor/core'

export const isNative = () => Capacitor.isNativePlatform()
export const getPlatform = () => Capacitor.getPlatform()

export function getServerUrl(): string | null {
  if (isNative()) {
    return import.meta.env.VITE_SERVER_URL || null
  }
  return null
}
