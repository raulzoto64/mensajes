import { useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import ChatPage from './pages/ChatPage'
import SetupPage from './pages/SetupPage'
import { supabaseConfigured } from './lib/supabase'
import { resubscribePush } from './lib/push'
import { startLiveLocation, stopLiveLocation } from './lib/liveLocation'

function Inner() {
  const { user } = useAuth()

  // (Re)suscripción de push con la clave VAPID actual. Forzamos una nueva
  // suscripción para reemplazar cualquier suscripción vieja (distinto par VAPID).
  useEffect(() => {
    if (user?.id) {
      resubscribePush(user.id).catch(() => {})
    }
  }, [user?.id])

  // Seguimiento de ubicación en tiempo real. Solo arranca si el permiso de
  // geolocalización ya fue concedido (para no mostrar un diálogo sorpresa).
  useEffect(() => {
    if (!user?.id) return
    let active = true
    const perms = navigator.permissions?.query?.({ name: 'geolocation' })
    if (perms && 'then' in perms) {
      perms
        .then((res) => {
          if (active && res.state === 'granted') startLiveLocation(user.id)
        })
        .catch(() => {})
    }
    return () => {
      active = false
      stopLiveLocation()
    }
  }, [user?.id])

  if (!supabaseConfigured) return <SetupPage />
  if (user?.is_approved === false) return <AuthPage />
  return user ? <ChatPage /> : <AuthPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  )
}
