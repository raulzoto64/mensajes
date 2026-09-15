import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

window.onerror = (msg, url, lineNo, _colNo, error) => {
  const err = `CRASH: ${msg}\n${url}:${lineNo}\n${error?.stack ?? ''}`
  console.error(err)
  alert(err)
  return true
}

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason instanceof Error ? `${e.reason.message}\n${e.reason.stack}` : String(e.reason)
  const msg = `PROMESA NO MANEJADA:\n${reason}`
  console.error(msg)
  alert(msg)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


