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

async function tjFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL || !API_SECRET) throw new TradeJournalNotConfigured()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), 'x-admin-api-key': API_SECRET },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TradeJournal API ${path}: HTTP ${res.status}${body ? ` — ${body}` : ''}`)
  }
  return res.json() as Promise<T>
}

export type TjUser = {
  id: string
  email: string
  displayName: string | null
  journalMode: string
  isAdmin: boolean
  createdAt: string
  exchangeConnectionCount: number
  closedTradeCount: number
  winRate: number | null
  pnl: number
}

export type TjExchangeConnection = {
  id: string
  exchange: string
  credentialKind: string
  label: string
  createdAt: string
  expiresAt: string | null
  lastSyncedAt: string | null
  lastSyncError: string | null
}

export type TjUserProfile = TjUser & {
  depositTotal: number
  exchangeConnections: TjExchangeConnection[]
  recentClosedTrades: { ticker: string; exchangeLabel: string; direction: string; closedAt: string | null; pnl: number }[]
}

export type TjConnection = {
  id: string
  userEmail: string
  exchange: string
  credentialKind: string
  label: string
  createdAt: string
  expiresAt: string | null
  lastSyncedAt: string | null
  lastSyncError: string | null
}

export type TjOverview = {
  userCount: number
  connectionsByExchange: { exchange: string; count: number }[]
  depositTotal: number
  closedTradeCount: number
  avgResidentWinRate: number | null
  residentsWithTradesCount: number
  pnl: number
  openTicketCount: number
}

export const tjOverview = () => tjFetch<TjOverview>('/api/admin/overview')
export const tjUsers = () => tjFetch<TjUser[]>('/api/admin/users')
export const tjUserProfile = (id: string) => tjFetch<TjUserProfile>(`/api/admin/users/${encodeURIComponent(id)}`)
export const tjConnections = () => tjFetch<TjConnection[]>('/api/admin/connections')

export const tjDeleteConnection = (id: string) =>
  tjFetch<{ ok: true }>(`/api/admin/connections/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const tjReplaceConnectionCredentials = (id: string, credentials: Record<string, string>) =>
  tjFetch<{ ok: true }>(`/api/admin/connections/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })
