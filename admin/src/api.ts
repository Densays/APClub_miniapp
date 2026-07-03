// API-клиент браузерной админки. Авторизация — по токену (= пароль), который
// сохраняется в localStorage и шлётся в заголовке x-admin-token.
// В dev Vite проксирует /api → localhost:3000; в проде — VITE_API_URL.

const API_BASE = (import.meta.env.VITE_API_URL as string) || ''
const TOKEN_KEY = 'apclub-admin-token'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function headers(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-admin-token': getToken() }
}

// ── Типы ─────────────────────────────────────────────────────────────────────
export type Social = { instagram?: string; linkedin?: string; telegram?: string; web?: string }
export type Unlock = { current: number; total: number; activatedAt?: number | null; bonusMonths?: number; elapsedMonths?: number }
export type Access = { until: number | null; active: boolean }

export type Profile = {
  userId: string
  firstName?: string
  lastName?: string
  username?: string
  avatar?: string
  email?: string
  city?: string
  birthDate?: string
  about?: string
  maritalStatus?: string
  occupation?: string
  focus?: string
  strategies?: string
  directions?: string
  topics?: string
  offer?: string
  avgResult?: string
  maxResult?: string
  strengths?: string
  weaknesses?: string
  canHelp?: string
  social?: Social
  allowMessages?: boolean
  showProfile?: boolean
  achievements?: string[]
  roleTiers?: Record<string, number>
  grants?: string[]
  activatedAt?: number
  bonusMonths?: number
  accessUntil?: number
  billingPeriod?: 'monthly' | 'quarterly' | 'semiannual' | 'annual'
  createdBy?: 'admin' | 'telegram'
  isAdmin?: boolean
  updatedAt?: number
  unlock?: Unlock
  access?: Access
}

export type Achievement = { id: string; title: string; icon: string; group: 'money' | 'role' }
export type Catalog = { achievements: Achievement[]; levels: string[] }
export type Perk = { stars: number; title: string; icon: string }

// ── Аутентификация ───────────────────────────────────────────────────────────
export async function login(password: string): Promise<string> {
  const r = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || !data.ok) throw new Error(data.error || `Ошибка входа (${r.status})`)
  setToken(data.token as string)
  return data.token as string
}

export async function checkAuth(): Promise<boolean> {
  if (!getToken()) return false
  try {
    const r = await fetch(`${API_BASE}/api/admin/check`, { headers: headers() })
    const data = await r.json().catch(() => ({}))
    return Boolean(data.ok)
  } catch {
    return false
  }
}

// ── Каталог / участники ───────────────────────────────────────────────────────
export async function getCatalog(): Promise<Catalog> {
  const r = await fetch(`${API_BASE}/api/catalog`)
  if (!r.ok) throw new Error(`Каталог не загрузился (${r.status})`)
  const data = await r.json()
  return { achievements: data.achievements ?? [], levels: data.levels ?? [] }
}

export async function saveCatalog(achievements: Achievement[]): Promise<Achievement[]> {
  const r = await fetch(`${API_BASE}/api/admin/catalog`, {
    method: 'PUT', headers: headers(), body: JSON.stringify({ achievements }),
  })
  if (!r.ok) throw new Error(`Каталог не сохранился (${r.status})`)
  return ((await r.json()).achievements as Achievement[]) ?? []
}

// Сохранить только названия уровней (достижения на сервере сохраняются как есть).
export async function saveLevels(levels: string[]): Promise<string[]> {
  const r = await fetch(`${API_BASE}/api/admin/catalog`, {
    method: 'PUT', headers: headers(), body: JSON.stringify({ levels }),
  })
  if (!r.ok) throw new Error(`Уровни не сохранились (${r.status})`)
  return ((await r.json()).levels as string[]) ?? []
}

export async function getProfiles(): Promise<Profile[]> {
  const r = await fetch(`${API_BASE}/api/admin/profiles`, { headers: headers() })
  if (r.status === 401) throw new Error('unauth')
  if (!r.ok) throw new Error(`Список не загрузился (${r.status})`)
  const data = await r.json()
  return (data.profiles as Profile[]) ?? []
}

// Мержим отдельный unlock/access из ответа в объект профиля.
function mergeMeta(data: { profile: Profile; unlock?: Unlock; access?: Access }): Profile {
  const merged: Profile = { ...data.profile, unlock: data.unlock ?? data.profile.unlock, access: data.access ?? data.profile.access }
  // accessUntil в JSON отсутствует, когда доступ сделали бессрочным (undefined
  // не сериализуется). Берём истину из access.until, иначе клиентский мерж
  // {...prev, ...p} сохранил бы старую дату (список/дашборд не обновились бы).
  if (data.access) merged.accessUntil = data.access.until ?? undefined
  return merged
}

export async function updateProfile(id: string, patch: Record<string, unknown>): Promise<Profile> {
  const r = await fetch(`${API_BASE}/api/admin/profile/${id}`, {
    method: 'PUT', headers: headers(), body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error(`Сохранение не удалось (${r.status})`)
  return mergeMeta(await r.json())
}

export async function createMember(patch: Record<string, unknown>): Promise<Profile> {
  const r = await fetch(`${API_BASE}/api/admin/profile`, {
    method: 'POST', headers: headers(), body: JSON.stringify(patch),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || !data.ok) throw new Error(data.error || `Создание не удалось (${r.status})`)
  return mergeMeta(data)
}

export async function deleteProfile(id: string): Promise<void> {
  const r = await fetch(`${API_BASE}/api/admin/profile/${id}`, { method: 'DELETE', headers: headers() })
  if (!r.ok) throw new Error(`Удаление не удалось (${r.status})`)
}

// ── Витрина клуба ─────────────────────────────────────────────────────────────
export type TrendPoint = { period: string; value: number | null }
export type Stats = {
  total: number
  active: number
  inactive: number
  engaged: number
  retention: number
  churnRate: number
  launches: { series: { date: string; launches: number }[]; total: number; today: number }
  retentionSeries: TrendPoint[]
  churnSeries: TrendPoint[]
}

export async function getStats(): Promise<Stats> {
  const r = await fetch(`${API_BASE}/api/admin/stats`, { headers: headers() })
  if (r.status === 401) throw new Error('unauth')
  if (!r.ok) throw new Error(`Статистика не загрузилась (${r.status})`)
  return (await r.json()) as Stats
}

// ── Уведомления о событиях ────────────────────────────────────────────────────
export type NotifEventId = 'sreda' | 'efir' | 'birthday' | 'weekplan' | 'weeksum'
export type NotifEventCfg = { enabled: boolean; template: string; sendHour: number; image?: string }
export type CustomNotif = { id: string; title: string; text: string; image?: string }
export type NotifConfig = {
  enabled: boolean
  events: Record<NotifEventId, NotifEventCfg>
  custom: CustomNotif[]
  sent: Record<string, number>
}
export type NotifOccurrence = {
  eventId: NotifEventId
  title: string
  dateKey: string
  dateLabel: string
  sendHour: number
  enabled: boolean
  message: string
  hasImage: boolean
  recipients: number
  sent: boolean
  sentAt?: number
}
export type NotifData = {
  config: NotifConfig
  upcoming: NotifOccurrence[]
  recipients: number
  botReady: boolean
  events: { id: NotifEventId; title: string; time: string | null }[]
}
export type SendReport = {
  ok: boolean
  delivered: number
  failed: number
  skipped: number
  total: number
  error?: string
  alreadySent?: boolean
  partial?: boolean
  nextOffset?: number
  retryAfter?: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Прогонка резюмируемой рассылки до конца: сервер обрабатывает список чанками
// (бюджет времени на функцию), возвращая partial+nextOffset; здесь докручиваем
// в цикле, аккумулируя статистику и сообщая прогресс. Так рассылка на 100+ не
// обрывается по таймауту serverless-функции.
async function runResumable(
  call: (offset: number) => Promise<SendReport>,
  onProgress?: (done: number, total: number) => void,
): Promise<SendReport> {
  let offset = 0
  const acc = { delivered: 0, failed: 0, skipped: 0, total: 0 }
  for (let guard = 0; guard < 500; guard++) {
    const rep = await call(offset)
    if (rep.error) return { ...rep, ...acc, delivered: acc.delivered + rep.delivered }
    acc.delivered += rep.delivered
    acc.failed += rep.failed
    acc.skipped += rep.skipped
    acc.total = rep.total
    const done = acc.delivered + acc.failed + acc.skipped
    onProgress?.(done, rep.total)
    if (!rep.partial) return { ok: rep.ok, ...acc, alreadySent: rep.alreadySent }
    offset = rep.nextOffset ?? done
    if (rep.retryAfter) await sleep(Math.min(rep.retryAfter, 60) * 1000 + 250)
  }
  return { ok: true, ...acc } // защитный предел итераций
}

export async function getNotifications(): Promise<NotifData> {
  const r = await fetch(`${API_BASE}/api/admin/notifications`, { headers: headers() })
  if (r.status === 401) throw new Error('unauth')
  if (!r.ok) throw new Error(`Уведомления не загрузились (${r.status})`)
  const d = await r.json()
  return { config: d.config, upcoming: d.upcoming ?? [], recipients: d.recipients ?? 0, botReady: Boolean(d.botReady), events: d.events ?? [] }
}

export async function saveNotifications(config: Partial<NotifConfig>): Promise<NotifConfig> {
  const r = await fetch(`${API_BASE}/api/admin/notifications`, {
    method: 'PUT', headers: headers(), body: JSON.stringify(config),
  })
  if (!r.ok) throw new Error(`Настройки не сохранились (${r.status})`)
  return (await r.json()).config as NotifConfig
}

async function postSend(path: string, payload: Record<string, unknown>): Promise<SendReport> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: headers(), body: JSON.stringify(payload),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok && !d.report) throw new Error(d.error || `Отправка не удалась (${r.status})`)
  return d.report as SendReport
}

export async function sendNotification(
  eventId: NotifEventId, dateKey: string, force = false,
  onProgress?: (done: number, total: number) => void,
): Promise<SendReport> {
  // force применяем только к первому чанку (offset 0); резюм-чанки идут по offset.
  return runResumable((offset) =>
    postSend('/api/admin/notifications/send', { eventId, dateKey, force: force && offset === 0, offset }), onProgress)
}

export async function sendCustomNotification(
  text: string, image?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<SendReport> {
  return runResumable((offset) =>
    postSend('/api/admin/notifications/send-custom', { text, image, offset }), onProgress)
}

export type ChannelStatus = {
  configured: boolean; hasLink: boolean; channelId: string
  isAdmin: boolean; canPost: boolean; canPin: boolean; title?: string; error?: string
}
export async function getChannelStatus(): Promise<ChannelStatus> {
  const r = await fetch(`${API_BASE}/api/admin/channel`, { headers: headers() })
  if (r.status === 401) throw new Error('unauth')
  if (!r.ok) throw new Error(`channel status ${r.status}`)
  return (await r.json()).status as ChannelStatus
}
export async function publishChannel(): Promise<{ ok: boolean; posted: boolean; pinned: boolean; error?: string }> {
  const r = await fetch(`${API_BASE}/api/admin/channel/publish`, { method: 'POST', headers: headers() })
  return (await r.json().catch(() => ({ ok: false, posted: false, pinned: false, error: 'network' })))
}

export async function testNotification(chatId: string, text: string, image?: string): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(`${API_BASE}/api/admin/notifications/test`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ chatId, text, image }),
  })
  return (await r.json().catch(() => ({ ok: false, error: 'network' }))) as { ok: boolean; error?: string }
}

// ── Каталог ресурсов (для выдачи доступа выбором из списка) ───────────────────
export async function getResources(): Promise<string[]> {
  const r = await fetch(`${API_BASE}/api/admin/resources`, { headers: headers() })
  if (r.status === 401) throw new Error('unauth')
  if (!r.ok) throw new Error(`Ресурсы не загрузились (${r.status})`)
  return ((await r.json()).resources as string[]) ?? []
}
export async function saveResources(resources: string[]): Promise<string[]> {
  const r = await fetch(`${API_BASE}/api/admin/resources`, {
    method: 'PUT', headers: headers(), body: JSON.stringify({ resources }),
  })
  if (!r.ok) throw new Error(`Ресурсы не сохранились (${r.status})`)
  return ((await r.json()).resources as string[]) ?? []
}

// ── Список допущенных email (гейт входа) ─────────────────────────────────────
export async function getAllowlist(): Promise<string[]> {
  const r = await fetch(`${API_BASE}/api/admin/allowlist`, { headers: headers() })
  if (r.status === 401) throw new Error('unauth')
  if (!r.ok) throw new Error(`Список почт не загрузился (${r.status})`)
  return ((await r.json()).emails as string[]) ?? []
}
export async function saveAllowlist(emails: string[]): Promise<string[]> {
  const r = await fetch(`${API_BASE}/api/admin/allowlist`, {
    method: 'PUT', headers: headers(), body: JSON.stringify({ emails }),
  })
  if (!r.ok) throw new Error(`Список почт не сохранился (${r.status})`)
  return ((await r.json()).emails as string[]) ?? []
}

export type PairRow = { a: string; aName: string; b: string; bName: string }
export async function getAdminPairs(): Promise<{ buddies: PairRow[]; matches: PairRow[] }> {
  const r = await fetch(`${API_BASE}/api/admin/pairs`, { headers: headers() })
  if (r.status === 401) throw new Error('unauth')
  if (!r.ok) throw new Error(`Пары не загрузились (${r.status})`)
  const d = await r.json()
  return { buddies: d.buddies ?? [], matches: d.matches ?? [] }
}

export async function getShowcase(): Promise<Perk[]> {
  const r = await fetch(`${API_BASE}/api/showcase`)
  if (!r.ok) throw new Error(`Витрина не загрузилась (${r.status})`)
  return ((await r.json()).perks as Perk[]) ?? []
}

export async function saveShowcase(perks: Perk[]): Promise<Perk[]> {
  const r = await fetch(`${API_BASE}/api/admin/showcase`, {
    method: 'PUT', headers: headers(), body: JSON.stringify({ perks }),
  })
  if (!r.ok) throw new Error(`Витрина не сохранилась (${r.status})`)
  return ((await r.json()).perks as Perk[]) ?? []
}

// ── Утилита: картинка-баннер → data:URL (сохраняет пропорции, макс. ширина 1080) ─
export function fileToBanner(file: File, maxW = 1080): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no canvas'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Утилита: фото → data:URL 256×256 ──────────────────────────────────────────
export function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no canvas'))
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale, h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
