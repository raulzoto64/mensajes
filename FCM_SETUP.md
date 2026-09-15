# Configuración de Notificaciones Push (FCM)

## Paso 1: Agregar `FCM_SERVER_KEY` en Supabase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) → tu proyecto → ⚙️ → Configuración → Cloud Messaging
2. Copiá el valor de `Server Key`
3. En [supabase.com](https://supabase.com) → tu proyecto → Edge Functions → Secrets → New Secret:
   - Nombre: `FCM_SERVER_KEY`
   - Valor: tu Server Key
4. En Edge Functions → `send-push` → reemplazá el archivo con el de este repo (`supabase/functions/send-push/index.ts`) y deployá.

## Paso 2: Instalar el APK actualizado

El APK que se genera en GitHub Actions (`Actions` → `Build Android APK`) ya incluye:
- `google-services.json` en `android/app/`
- Firebase BOM (`com.google.firebase:firebase-bom:34.19.0`)
- `firebase-messaging`
- Permisos de notificación (`POST_NOTIFICATIONS`)
- Plugin nativo `push-notifications`

## Paso 3: Probar

1. Instalá el APK en tu celular
2. Iniciá sesión con una cuenta normal
3. Aprobá los permisos que pida la app
4. Desde otra cuenta (o la misma en otro dispositivo/navegador con URL `?admin=1`), abrí el admin panel
5. Enviá un mensaje o verificá los logs en `/?debug=1`
6. Debería llegar la notificación push nativa
