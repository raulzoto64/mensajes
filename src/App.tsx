import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import ChatPage from './pages/ChatPage'
import SetupPage from './pages/SetupPage'
import DebugPage from './components/DebugPage'
import { supabaseConfigured } from './lib/supabase'

function Inner() {
  const { user } = useAuth()
  if (!supabaseConfigured) return <SetupPage />
  if (user?.is_approved === false) return <AuthPage />
  if (new URLSearchParams(window.location.search).get('debug') === '1') {
    return <DebugPage />
  }
  return user ? <ChatPage /> : <AuthPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  )
}
