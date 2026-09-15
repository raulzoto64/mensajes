import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ephemera.app',
  appName: 'Ephemera',
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
  // Plugins nativos desactivados temporalmente para evitar crash
  // en el APK hasta configurar Firebase completamente en el dispositivo
  plugins: {},
}

export default config
