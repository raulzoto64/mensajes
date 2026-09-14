import { useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import ChatPage from './pages/ChatPage'
import SetupPage from './pages/SetupPage'
import { supabaseConfigured } from './lib/supabase'
import { resubscribePush } from './lib/push'
import { startLiveLocation, stopLiveLocation } from './lib/liveLocation'
import { CallProvider } from './contexts/CallContext'
import { isNative } from './lib/capacitor'
import ToastContainer, { showToast } from './components/Toast'

function Inner() {
  const { user } = useAuth()

  useEffect(() => {
    if (user?.id) {
      resubscribePush(user.id).then((r) => {
        if (!r.ok) showToast(`Push: ${r.error}`)
      })
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    let active = true
    if (isNative()) {
      if (active) startLiveLocation(user.id)
      return () => {
        active = false
        stopLiveLocation()
      }
    }
    const perms = navigator.permissions?.query?.({ name: 'geolocation' })
    if (perms && 'then' in perms) {
      perms
        .then((res) => {
          if (active && res.state === 'granted') startLiveLocation(user.id)
          else if (active && res.state === 'denied') showToast('Permiso de ubicación denegado')
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
  return user ? <CallProvider><ChatPage /></CallProvider> : <AuthPage />
}

export default function App() {
  return (
    <AuthProvider>
      <ToastContainer />
      <Inner />
    </AuthProvider>
  )
}
