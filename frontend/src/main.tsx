import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { init, miniApp } from '@telegram-apps/sdk-react'
import App from './App.tsx'
import './theme.css'

// Инициализация Telegram Mini App SDK.
// Безопасно работает и вне Telegram (для локальной разработки в браузере).
try {
  init()
  if (miniApp.mountSync.isAvailable()) {
    miniApp.mountSync()
    miniApp.ready()
  }
} catch (e) {
  console.warn('Telegram SDK init skipped (running outside Telegram):', e)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
