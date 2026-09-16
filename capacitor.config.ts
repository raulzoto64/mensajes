import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ephemera.app',
  appName: 'ComunidadOg',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    Geolocation: {
      backgroundLocationLabel: 'ComunidadOg está compartiendo tu ubicación',
      backgroundLocationDescription: 'Seguimiento de ubicación en segundo plano para mensajería.',
    },
  },
}

export default config
