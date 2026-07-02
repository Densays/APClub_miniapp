import * as TG from '@telegram-apps/sdk-react'

// Клиент API мини-приложения. В dev Vite проксирует /api → localhost:3000,
// в проде адрес берётся из VITE_API_URL.
const API_BASE = (import.meta.env.VITE_API_URL as string) || ''

export type ProfileSocial = {
  instagram?: string
  linkedin?: string
  telegram?: string
  web?: string
}

export type ProfileData = {
  userId?: string
  firstName?: string
  lastName?: string
  username?: string
  avatar?: string
  email?: string
  registeredAt?: number
  city?: string
  birthDate?: string
  about?: string
  maritalStatus?: string
  occupation?: string
  strengths?: string
  weaknesses?: string
  canHelp?: string
  social?: ProfileSocial
  allowMessages?: boolean
  showProfile?: boolean
  achievements?: string[]
}

// Сырая строка initData для подписи на сервере. Вне Telegram — 'dev'
// (сервер принимает при ALLOW_DEV_AUTH=1).
function getInitDataRaw(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (window as any)?.Telegram?.WebApp?.initData
    if (raw) return raw
  } catch {
    /* вне Telegram */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (TG as any).retrieveRawInitData
    if (typeof fn === 'function') {
      const raw = fn()
      if (raw) return raw
    }
  } catch {
    /* вне Telegram */
  }
  return 'dev'
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `tma ${getInitDataRaw()}`,
  }
}

export type Unlock = { current: number; total: number; activatedAt?: number | null; bonusMonths?: number; elapsedMonths?: number }

export async function getMyProfile(): Promise<{ profile: ProfileData; unlock: Unlock; isAdmin: boolean; registered: boolean }> {
  const r = await fetch(`${API_BASE}/api/profile/me`, { headers: authHeaders() })
  if (!r.ok) throw new Error(`profile load failed: ${r.status}`)
  const data = await r.json()
  return {
    profile: data.profile as ProfileData,
    unlock: (data.unlock as Unlock) ?? { current: 0, total: 12 },
    isAdmin: Boolean(data.isAdmin),
    registered: Boolean(data.registered),
  }
}

// Регистрация: первый онбординг (имя/фамилия/почта/аватар). Ставит registeredAt.
export async function registerProfile(input: { firstName: string; lastName: string; email: string; avatar?: string }): Promise<ProfileData> {
  const r = await fetch(`${API_BASE}/api/profile/register`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(input),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || !data.ok) throw new Error(data.error || `register failed: ${r.status}`)
  return data.profile as ProfileData
}

export async function saveMyProfile(patch: Partial<ProfileData>): Promise<ProfileData> {
  const r = await fetch(`${API_BASE}/api/profile/me`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error(`profile save failed: ${r.status}`)
  const data = await r.json()
  return data.profile as ProfileData
}

// Список участников сообщества (общая база).
export async function getProfiles(): Promise<ProfileData[]> {
  const r = await fetch(`${API_BASE}/api/profiles`, { headers: authHeaders() })
  if (!r.ok) throw new Error(`profiles load failed: ${r.status}`)
  const data = await r.json()
  return (data.profiles as ProfileData[]) ?? []
}

export type BuddyResult = { buddy: ProfileData | null; month: string; chosen?: boolean; alreadyChosen?: boolean; empty?: boolean }

// Текущий бадди месяца (если уже выбран).
export async function getBuddy(): Promise<BuddyResult> {
  const r = await fetch(`${API_BASE}/api/buddy`, { headers: authHeaders() })
  if (!r.ok) throw new Error(`buddy load failed: ${r.status}`)
  return (await r.json()) as BuddyResult
}

// Выбрать бадди на месяц (раз в месяц; если уже выбран — вернётся тот же).
export async function findBuddy(): Promise<BuddyResult> {
  const r = await fetch(`${API_BASE}/api/buddy`, { method: 'POST', headers: authHeaders() })
  if (!r.ok) throw new Error(`buddy pick failed: ${r.status}`)
  return (await r.json()) as BuddyResult
}

// Админ: обновить профиль любого участника (поля, прогресс, достижения).
export async function adminUpdateProfile(id: string, patch: Record<string, unknown>): Promise<ProfileData> {
  const r = await fetch(`${API_BASE}/api/admin/profile/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error(`admin update failed: ${r.status}`)
  return (await r.json()).profile as ProfileData
}

// Профиль конкретного участника по id.
export async function getProfileById(id: string): Promise<ProfileData> {
  const r = await fetch(`${API_BASE}/api/profile/${id}`, { headers: authHeaders() })
  if (!r.ok) throw new Error(`profile load failed: ${r.status}`)
  const data = await r.json()
  return data.profile as ProfileData
}

// Фиксируем запуск приложения (для дашборда админки). Вызывается один раз при
// старте. Ошибки глушим — трекинг не должен ломать вход.
export async function recordLaunch(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/launch`, { method: 'POST', headers: authHeaders() })
  } catch {
    /* трекинг не критичен */
  }
}

// Перки Витрины клуба. Единый источник — БД (то, что редактирует админка).
// Правки в админке отображаются здесь сразу после сохранения/публикации.
export type Perk = { stars: number; title: string; icon: string }
export async function getShowcase(): Promise<Perk[]> {
  const r = await fetch(`${API_BASE}/api/showcase`)
  if (!r.ok) throw new Error(`showcase load failed: ${r.status}`)
  return ((await r.json()).perks as Perk[]) ?? []
}
