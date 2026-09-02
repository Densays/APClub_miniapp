import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Разрешаем хосты cloudflare-туннеля (для теста Mini App внутри Telegram).
    allowedHosts: ['.trycloudflare.com'],
    // 3001, not the API server's old default 3000 — that port is now
    // TradeJournal's locally (~/Densays/TradeJournal), see server/.env's
    // PORT comment.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
