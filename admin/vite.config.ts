import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Отдельная браузерная админка. Dev-сервер на :5174 (чтобы не конфликтовать с
// Mini App на :5173), проксирует /api → API-сервер на :3001 (не 3000 — см.
// server/.env's PORT comment: 3000 занят соседним TradeJournal локально).
// В проде адрес API берётся из VITE_API_URL (см. .env.production).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
