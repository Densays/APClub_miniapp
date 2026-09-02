// Прокси к API-мосту TradeJournal (см. в том проекте
// src/lib/server/admin-api-auth.ts). Секрет живёт только тут, на сервере —
// index.ts вызывает эти функции из уже-защищённых requireAdmin-роутов,
// фронт этой админки никогда не видит ни секрет, ни адрес TradeJournal
// напрямую.

const API_URL = process.env.TRADEJOURNAL_API_URL ?? ''
const API_SECRET = process.env.TRADEJOURNAL_ADMIN_API_SECRET ?? ''

class TradeJournalNotConfigured extends Error {
  constructor() {
    super('TradeJournal bridge is not configured (TRADEJOURNAL_API_URL / TRADEJOURNAL_ADMIN_API_SECRET)')
  }
}

async function tjGet<T>(path: string): Promise<T> {
  if (!API_URL || !API_SECRET) throw new TradeJournalNotConfigured()
  const res = await fetch(`${API_URL}${path}`, { headers: { 'x-admin-api-key': API_SECRET } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TradeJournal API ${path}: HTTP ${res.status}${body ? ` — ${body}` : ''}`)
  }
  return res.json() as Promise<T>
}

export const tjOverview = () => tjGet<unknown>('/api/admin/overview')
export const tjUsers = () => tjGet<unknown>('/api/admin/users')
export const tjUserProfile = (id: string) => tjGet<unknown>(`/api/admin/users/${encodeURIComponent(id)}`)
export const tjConnections = () => tjGet<unknown>('/api/admin/connections')
