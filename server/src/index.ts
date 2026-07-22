import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { validateInitData } from './initData.ts'
import type { TelegramUser } from './initData.ts'
import { store, sanitizePatch, sanitizeAdminPatch } from './store.ts'
import type { Profile } from './store.ts'
import { ACHIEVEMENTS, LEVELS, DEFAULT_PERKS } from './content.ts'
import type { Perk } from './content.ts'
import {
  loadConfig as loadNotifConfig,
  updateConfig as updateNotifConfig,
  upcoming as upcomingEvents,
  recipients as notifRecipients,
  sendEvent as sendNotifEvent,
  sendCustom as sendNotifCustom,
  sendTest as sendNotifTest,
  runDueNotifications,
  EVENT_DEFS,
  type EventId,
} from './notifications.ts'
import { startBot, channelStatus, publishChannelEntry, publishChannelCustom, sendTestWithButton, handleUpdate, setWebhook, fetchUsername, sendNetworkingRequest, confirmNetworking, flushFollowups, sendEfirRegistrationAlert } from './bot.ts'

const app = express()
const PORT = Number(process.env.PORT) || 3000
const BOT_TOKEN = process.env.BOT_TOKEN ?? ''
// Dev-режим: при ALLOW_DEV_AUTH=1 разрешаем вход без Telegram (тестовый юзер).
// В проде флаг должен быть выключен.
const ALLOW_DEV_AUTH = process.env.ALLOW_DEV_AUTH === '1'
// Список Telegram-id администраторов (через запятую) — для админки внутри Telegram.
const ADMIN_IDS = (process.env.ADMIN_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// Пароль отдельной браузерной админ-панели (deploy в apk-lab).
// Standalone-админка не имеет Telegram initData, поэтому авторизуется паролем:
// логинится → получает токен (= сам пароль) → шлёт его в заголовке x-admin-token.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''
if (!ADMIN_PASSWORD) {
  console.warn('⚠️  ADMIN_PASSWORD не задан — вход в браузерную админку по паролю недоступен.')
}

// Тестовый пользователь для локальной разработки вне Telegram
// Тестовый пользователь для локальной разработки вне Telegram.
// Имя/ник совпадают с моком фронта, чтобы локально не мелькал «Dev Tester».
const DEV_USER: TelegramUser = {
  id: 99999999,
  first_name: 'Denis',
  last_name: 'Sh',
  username: 'denflow',
  language_code: 'ru',
}

if (!BOT_TOKEN) {
  console.warn('⚠️  BOT_TOKEN не задан — проверка initData будет падать (это нормально вне Telegram).')
}
if (ALLOW_DEV_AUTH) {
  console.warn('🛠  ALLOW_DEV_AUTH=1 — включён dev-вход без Telegram. Не используйте в проде!')
}

// CORS: ограничиваем известными доменами Mini App / админки (+ localhost для dev
// + опц. ALLOWED_ORIGINS из env). Запросы без Origin (сервер-сервер, Telegram
// webhook, cron, curl) пропускаем — их защищает токен/секрет, не CORS.
const CORS_ALLOW = [
  'https://apclub.vercel.app',
  'https://apclub-admin.vercel.app',
  process.env.MINIAPP_URL,
  process.env.ADMIN_URL,
  ...(process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()),
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173',
].filter((x): x is string => Boolean(x))
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || CORS_ALLOW.includes(origin)) return cb(null, true)
      cb(null, false)
    },
  }),
)
// Лимит поднят: профили и уведомления могут нести base64-картинки (аватар/баннер).
app.use(express.json({ limit: '12mb' }))

// Health-check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() })
})

// Каталог контента (ачивки + названия уровней) — общий для приложения и админки.
// Редактируется в разделе «Геймификация»; хранится в служебной записи __catalog.
// Кэш названий уровней — чтобы computeUnlock знал их число без лишних чтений БД.
// Прогревается в loadCatalog, инвалидируется при сохранении каталога.
let _levelsCache: string[] | null = null

async function loadCatalog(): Promise<{ achievements: typeof ACHIEVEMENTS; levels: string[] }> {
  const row = (await store.get(CATALOG_KEY)) as unknown as { achievements?: typeof ACHIEVEMENTS; levels?: string[] } | null
  const levels = Array.isArray(row?.levels) && row!.levels!.length ? row!.levels! : LEVELS
  _levelsCache = levels
  return {
    achievements: Array.isArray(row?.achievements) && row!.achievements.length ? row!.achievements! : ACHIEVEMENTS,
    levels,
  }
}

// Актуальные названия уровней (из кэша или подгрузив каталог). Число = кол-во уровней.
async function getLevels(): Promise<string[]> {
  if (_levelsCache) return _levelsCache
  return (await loadCatalog()).levels
}

function sanitizeAchievements(input: unknown): typeof ACHIEVEMENTS {
  if (!Array.isArray(input)) return []
  return input
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map((a, i) => ({
      id: String(a.id ?? `ach_${i}`).slice(0, 60).replace(/[^\w-]/g, '') || `ach_${i}`,
      title: String(a.title ?? '').slice(0, 200),
      icon: String(a.icon ?? '🏅').slice(0, 8),
      group: (a.group === 'role' ? 'role' : 'money') as 'money' | 'role',
    }))
    .filter((a) => a.title.length > 0)
    .slice(0, 200)
}

app.get('/api/catalog', ah(async (_req, res) => {
  const c = await loadCatalog()
  res.json({ ok: true, achievements: c.achievements, levels: c.levels })
}))

// Сохранение каталога достижений (админ, раздел «Геймификация»).
app.put('/api/admin/catalog', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const body = (req.body ?? {}) as Record<string, unknown>
  const current = await loadCatalog()
  // Достижения обновляем только если пришли (иначе сохраняем текущие — чтобы
  // сохранение одних лишь уровней не стёрло каталог достижений).
  let achievements = current.achievements
  if (body.achievements !== undefined) {
    const seen = new Set<string>()
    achievements = sanitizeAchievements(body.achievements)
      .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
  }
  // Уровни: непустые строки, до 24; пустые/пробельные отбрасываем.
  const levels = Array.isArray(body.levels)
    ? body.levels.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 60)).filter(Boolean).slice(0, 24)
    : current.levels
  await store.upsert(CATALOG_KEY, { achievements, levels } as unknown as Partial<Profile>)
  _levelsCache = levels.length ? levels : null // инвалидируем кэш числа уровней
  res.json({ ok: true, achievements, levels })
}))

// Достаёт initData из заголовка "Authorization: tma <initData>"
function getInitData(req: express.Request): string {
  const auth = req.header('authorization') ?? ''
  const [scheme, value] = auth.split(' ')
  return scheme === 'tma' && value ? value : ''
}

// Возвращает авторизованного пользователя или null (с учётом dev-режима).
function resolveUser(req: express.Request): TelegramUser | null {
  const initData = getInitData(req)
  if (ALLOW_DEV_AUTH && (initData === 'dev' || initData === '')) {
    return DEV_USER
  }
  return validateInitData(initData, BOT_TOKEN)
}

function isAdmin(user: TelegramUser): boolean {
  return ADMIN_IDS.includes(String(user.id))
}
// Админ = в ADMIN_IDS (env) ИЛИ флаг isAdmin в профиле (назначен из веб-админки).
async function userIsAdmin(user: TelegramUser): Promise<boolean> {
  if (isAdmin(user)) return true
  const p = await store.get(String(user.id))
  return p?.isAdmin === true
}

// Токен браузерной админки из заголовка "x-admin-token".
function getAdminToken(req: express.Request): string {
  return req.header('x-admin-token') ?? ''
}

// Сравнение токенов постоянного времени (защита от тайминг-атак по паролю).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Запрос имеет админ-права, если: (а) валидный токен браузерной админки,
// либо (б) авторизованный Telegram-пользователь входит в ADMIN_IDS.
async function isAdminRequest(req: express.Request): Promise<boolean> {
  const token = getAdminToken(req)
  if (ADMIN_PASSWORD && token && safeEqual(token, ADMIN_PASSWORD)) return true
  const user = resolveUser(req)
  return user ? userIsAdmin(user) : false
}

// Гард для админ-роутов: 401, если запрос не админский.
async function requireAdmin(req: express.Request, res: express.Response): Promise<boolean> {
  if (await isAdminRequest(req)) return true
  res.status(401).json({ ok: false, error: 'Admin auth required' })
  return false
}

// ── Прогресс разблокировки по месяцам ────────────────────────────────────────
const TOTAL_LEVELS = 12

// Сколько полных календарных месяцев прошло между двумя датами.
function monthsBetween(fromMs: number, toMs: number): number {
  const from = new Date(fromMs)
  const to = new Date(toMs)
  let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) m--
  return Math.max(0, m)
}

// Прогресс идёт АВТОМАТИЧЕСКИ с момента активации (elapsed месяцев) + ручная
// корректировка админа (bonusMonths, ±). Итог ограничен 0..12.
function computeUnlock(profile: Profile, total: number = TOTAL_LEVELS) {
  const cap = Math.max(1, total)
  const activatedAt = profile.activatedAt ?? Date.now()
  const bonus = profile.bonusMonths ?? 0
  const elapsed = monthsBetween(activatedAt, Date.now())
  const current = Math.max(0, Math.min(elapsed + bonus, cap))
  return { current, total: cap, activatedAt, bonusMonths: bonus, elapsedMonths: elapsed }
}

// Доступ к приложению: если задан accessUntil и он в прошлом — доступ закрыт
// (по решению пользователя закрывается ВЕСЬ вход в приложение).
function computeAccess(profile: Profile) {
  const until = profile.accessUntil ?? null
  const active = until === null || until > Date.now()
  return { until, active }
}

// Служебные записи (настройки, витрина) хранятся в той же таблице под ключами
// с префиксом «__» — их нельзя показывать в списках участников.
const RESERVED_PREFIX = '__'
const isReserved = (id: string) => id.startsWith(RESERVED_PREFIX)
const onlyMembers = (list: Profile[]) => list.filter((p) => !isReserved(p.userId))

// Прячем прямой Telegram-контакт (@username + social.telegram) из профилей,
// отдаваемых при просмотре (Сообщество/карточка/свайпы). Написать напрямую можно
// только по взаимному мэтчу — там контакт НЕ вырезаем. Прочие соцсети остаются.
function stripTelegram<T extends Profile>(p: T): T {
  const { username, ...rest } = p
  void username
  const out = rest as T
  if (p.social && p.social.telegram) {
    const social = { ...p.social }
    delete social.telegram
    return { ...out, social }
  }
  return out
}

const SHOWCASE_KEY = '__showcase'
const CATALOG_KEY = '__catalog'
const STATS_KEY = '__stats'
const RESOURCES_KEY = '__resources'
const ALLOWLIST_KEY = '__allowlist' // список допущенных email (гейт входа)
// Каталог выдаваемых ресурсов (для «Доступ к ресурсам» — выбор из списка).
const DEFAULT_RESOURCES = ['Кабинет APClub', 'Канал SpreadHunter', 'Блок DEX', 'Групповой мастермайнд', 'Команда тестировщиков', 'Записи эфиров', 'Материалы клуба']

// День в формате YYYY-MM-DD (UTC) — ключ для посуточной статистики запусков.
function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
const DAY_MS = 24 * 60 * 60 * 1000

// «Эфир в клубе»: Чт 19:00 МСК (зеркалит EVENT_DEFS.efir в notifications.ts).
const EFIR_TIME = '19:00'
const EFIR_MSK_OFFSET = 3 * 3600 * 1000
// Дата (YYYY-MM-DD, МСК) ближайшего эфира: сегодня, если ещё не наступил
// (или идёт), иначе следующий четверг.
function nextEfirDateKey(now = Date.now()): string {
  const d = new Date(now + EFIR_MSK_OFFSET)
  const dow = d.getUTCDay() // Чт = 4
  let addDays = (4 - dow + 7) % 7
  if (addDays === 0 && d.getUTCHours() >= 19) addDays = 7 // сегодняшний эфир уже прошёл
  const target = new Date(d.getTime() + addDays * DAY_MS)
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`
}

// Ключ месяца YYYY-MM со сдвигом на delta месяцев (для трендов retention/churn).
function ymKey(ms: number, delta = 0): string {
  const d = new Date(ms)
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + delta
  const y = Math.floor(total / 12)
  const m = total % 12
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

// Профиль по умолчанию — данные из Telegram, если пользователь ещё не заполнял.
function withDefaults(user: TelegramUser, stored: Profile | null): Profile {
  const base: Profile = {
    userId: String(user.id),
    firstName: user.first_name ?? '',
    lastName: user.last_name ?? '',
    username: user.username ?? '',
    avatar: user.photo_url ?? '',
    allowMessages: true,
    showProfile: true,
  }
  return stored ? { ...base, ...stored } : base
}

// Возвращает данные текущего пользователя после проверки подписи
app.get('/api/me', (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid or missing initData' })
  res.json({ ok: true, dev: ALLOW_DEV_AUTH && user.id === DEV_USER.id, user })
})

// Обёртка для async-роутов: ловит ошибки (в т.ч. от БД) и отдаёт чистый 500,
// вместо «зависания» запроса при необработанном промис-реджекте.
type AsyncHandler = (req: express.Request, res: express.Response) => Promise<unknown>
function ah(fn: AsyncHandler) {
  return (req: express.Request, res: express.Response) => {
    fn(req, res).catch((err) => {
      console.error('API error:', err?.message ?? err)
      if (!res.headersSent) res.status(500).json({ ok: false, error: 'Server error' })
    })
  }
}

// ── Профиль текущего пользователя ────────────────────────────────────────────

app.get('/api/profile/me', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  let stored = await store.get(String(user.id))
  // Активация: фиксируем момент первого входа в приложение.
  if (!stored?.activatedAt) {
    stored = await store.upsert(String(user.id), { activatedAt: Date.now() })
  }
  const profile = withDefaults(user, stored)
  const total = (await getLevels()).length
  res.json({
    ok: true,
    profile,
    registered: Boolean(profile.registeredAt),
    unlock: computeUnlock(profile, total),
    access: computeAccess(profile),
    isAdmin: await userIsAdmin(user),
  })
}))

app.put('/api/profile/me', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const patch = sanitizePatch(req.body)
  const saved = await store.upsert(String(user.id), patch)
  res.json({ ok: true, profile: withDefaults(user, saved) })
}))

// Регистрация (гейт входа): первый онбординг в мини-аппе. Обязательны имя, фамилия,
// корректная почта; аватар опционален (по умолчанию из Telegram). Ставим registeredAt.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
app.post('/api/profile/register', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const b = (req.body ?? {}) as { firstName?: string; lastName?: string; email?: string; avatar?: string }
  const firstName = String(b.firstName ?? '').trim().slice(0, 100)
  const lastName = String(b.lastName ?? '').trim().slice(0, 100)
  const email = String(b.email ?? '').trim().slice(0, 200)
  if (!firstName || !lastName) return res.status(400).json({ ok: false, error: 'name_required' })
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'bad_email' })

  // Гейт входа по почте: (1) почта должна быть в списке допуска (если он задан);
  // (2) почта не должна быть уже занята ДРУГИМ аккаунтом.
  const emailNorm = email.toLowerCase()
  const allow = await loadAllowlist()
  if (allow.length && !allow.includes(emailNorm)) {
    return res.status(403).json({ ok: false, error: 'email_not_allowed' })
  }
  const meId = String(user.id)
  // Лёгкий гейт (без вытягивания всей таблицы с аватарами): ищем владельца почты.
  const owner = await store.emailOwner(emailNorm, meId)
  if (owner) return res.status(409).json({ ok: false, error: 'email_taken' })

  const patch: Partial<Profile> = { firstName, lastName, email, registeredAt: Date.now() }
  if (typeof b.avatar === 'string' && b.avatar) patch.avatar = b.avatar.slice(0, 3_000_000)
  const saved = await store.upsert(String(user.id), patch)
  const profile = withDefaults(user, saved)
  const total = (await getLevels()).length
  res.json({ ok: true, profile, registered: true, unlock: computeUnlock(profile, total), access: computeAccess(profile) })
}))

// ── Просмотр профилей других участников (общая база) ──────────────────────────

app.get('/api/profiles', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const all = onlyMembers(await store.list())
  // Показываем только тех, кто разрешил отображение (админ видит всех).
  const visible = isAdmin(user) ? all : all.filter((p) => p.showProfile !== false)
  // Обогащаем прогрессом (для «текущего статуса в клубе» в списке Сообщества).
  const total = (await getLevels()).length
  const enriched = visible.map((p) => ({ ...stripTelegram(p), unlock: computeUnlock(p, total) }))
  res.json({ ok: true, profiles: enriched })
}))

app.get('/api/profile/:id', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const p = await store.get(String(req.params.id))
  if (!p) return res.status(404).json({ ok: false, error: 'Not found' })
  if (p.showProfile === false && !isAdmin(user) && String(user.id) !== String(req.params.id)) {
    return res.status(403).json({ ok: false, error: 'Profile hidden' })
  }
  // Свой профиль отдаём целиком; чужой — без прямого Telegram-контакта.
  const out = String(user.id) === String(req.params.id) ? p : stripTelegram(p)
  res.json({ ok: true, profile: out })
}))

// ── Нетворкинг: знакомства (свайпы) ──────────────────────────────────────────
// Лимит запросов на знакомство: 5 в скользящую неделю. Отправка запроса тратит
// лимит; ответ на входящий (взаимность) — нет.
const WEEKLY_REQUESTS = 5
function coffeeQuota(me: Profile | null) {
  const at = me?.coffeeLikeAt ?? {}
  const since = Date.now() - 7 * DAY_MS
  const recent = Object.values(at).filter((t) => typeof t === 'number' && t > since).sort((a, b) => a - b)
  const used = recent.length
  return {
    limit: WEEKLY_REQUESTS,
    used,
    remaining: Math.max(0, WEEKLY_REQUESTS - used),
    resetAt: used >= WEEKLY_REQUESTS ? recent[0] + 7 * DAY_MS : null,
  }
}

// Истечение исходящих запросов: неотвеченный (без взаимности) запрос живёт 24ч.
// По истечении удаляется — слот освобождается, участник снова доступен для выбора.
const REQUEST_TTL_MS = 24 * 60 * 60 * 1000
// Истёк ли исходящий запрос (по таймстемпу в coffeeLikeAt отправителя): старше 24ч.
function isRequestExpired(senderAt: Record<string, number> | undefined, targetId: string, now: number): boolean {
  const ts = senderAt?.[targetId]
  return typeof ts === 'number' && now - ts > REQUEST_TTL_MS
}
async function pruneExpiredRequests(me: Profile | null, byId: Map<string, Profile>): Promise<Profile | null> {
  if (!me?.coffeeLikes?.length) return me
  const now = Date.now()
  const at = { ...(me.coffeeLikeAt ?? {}) }
  let changed = false
  const likes = me.coffeeLikes.filter((id) => {
    const t = byId.get(id)
    if (t && (t.coffeeLikes ?? []).includes(me.userId)) return true // мэтч не истекает
    if (isRequestExpired(at, id, now)) { delete at[id]; changed = true; return false }
    return true
  })
  if (!changed) return me
  return await store.upsert(me.userId, { coffeeLikes: likes, coffeeLikeAt: at })
}

// Кандидаты: резиденты, которым я ещё НЕ отправлял запрос (пропущенные снова
// появляются). Перед выдачей чистим истёкшие запросы (24ч) — освобождают слот.
app.get('/api/coffee/candidates', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const meId = String(user.id)
  const all = onlyMembers(await store.list())
  const byId = new Map(all.map((p) => [p.userId, p]))
  const me = await pruneExpiredRequests(await store.get(meId), byId)
  const requested = new Set<string>([...(me?.coffeeLikes ?? []), meId])
  const total = (await getLevels()).length
  const cands = all
    // не запрошенные мной И не приславшие запрос мне (входящие — в отдельной вкладке)
    .filter((p) => p.showProfile !== false && p.registeredAt && !requested.has(p.userId) && !(p.coffeeLikes ?? []).includes(meId))
    .slice(0, 100)
    .map((p) => ({ ...stripTelegram(p), unlock: computeUnlock(p, total) }))
  res.json({ ok: true, candidates: cands, quota: coffeeQuota(me) })
}))

// Свайп: like=true — отправить запрос на знакомство. like=false — пропустить
// (только на клиенте, сервер не хранит). Взаимность = мэтч + уведомление обоим.
app.post('/api/coffee/swipe', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const meId = String(user.id)
  const body = (req.body ?? {}) as { targetId?: string; like?: boolean }
  const targetId = String(body.targetId ?? '')
  if (!targetId || targetId === meId || isReserved(targetId)) {
    return res.status(400).json({ ok: false, error: 'bad_target' })
  }
  if (!body.like) return res.json({ ok: true, passed: true }) // пропуск — клиентский
  const me = (await store.get(meId)) ?? ({ userId: meId } as Profile)
  const target = await store.get(targetId)
  if (!target) return res.status(400).json({ ok: false, error: 'bad_target' })
  const total = (await getLevels()).length

  // Взаимность (цель уже отправляла мне запрос) → мэтч, лимит НЕ тратится.
  if ((target.coffeeLikes ?? []).includes(meId)) {
    await confirmNetworking(meId, targetId)
    return res.json({ ok: true, matched: true, target: { ...target, unlock: computeUnlock(target, total) }, quota: coffeeQuota(me) })
  }

  // Новый запрос → проверяем недельный лимит. Исчерпан — тихо блокируем (без ошибки).
  const q = coffeeQuota(me)
  if (q.remaining <= 0) return res.json({ ok: true, blocked: true, quota: q })

  const likes = new Set(me.coffeeLikes ?? []); likes.add(targetId)
  const at = { ...(me.coffeeLikeAt ?? {}) }; at[targetId] = Date.now()
  const saved = await store.upsert(meId, { coffeeLikes: [...likes], coffeeLikeAt: at })
  const fromName = `${saved.firstName ?? ''} ${saved.lastName ?? ''}`.trim() || 'Резидент клуба'
  sendNetworkingRequest(targetId, fromName, meId).catch(() => {}) // DM с кнопкой «Подтвердить»
  res.json({ ok: true, matched: false, quota: coffeeQuota(saved) })
}))

// Входящие запросы на знакомство: кто отправил запрос мне, а я ещё не ответил.
app.get('/api/coffee/incoming', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const meId = String(user.id)
  const me = await store.get(meId)
  const myLikes = new Set(me?.coffeeLikes ?? [])
  const now = Date.now()
  const total = (await getLevels()).length
  const incoming = onlyMembers(await store.list())
    // отправил запрос мне, я ещё не ответил, и запрос не истёк (24ч)
    .filter((p) => p.userId !== meId && (p.coffeeLikes ?? []).includes(meId) && !myLikes.has(p.userId)
      && !isRequestExpired(p.coffeeLikeAt, meId, now))
    .map((p) => ({ ...stripTelegram(p), unlock: computeUnlock(p, total) }))
  res.json({ ok: true, incoming })
}))

// Подтвердить входящий запрос (ответить взаимностью) — из приложения. Мэтч.
app.post('/api/coffee/confirm', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const meId = String(user.id)
  const fromId = String((req.body as { fromId?: string })?.fromId ?? '')
  if (!fromId) return res.status(400).json({ ok: false, error: 'bad_target' })
  const r = await confirmNetworking(meId, fromId)
  res.json({ ok: r.ok, matched: r.matched })
}))

// Мои мэтчи — резиденты, с кем взаимный лайк (для связи в TG).
app.get('/api/coffee/matches', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const meId = String(user.id)
  const byId = new Map(onlyMembers(await store.list()).map((p) => [p.userId, p]))
  const me = await pruneExpiredRequests(await store.get(meId), byId)
  const myLikes = new Set(me?.coffeeLikes ?? [])
  const total = (await getLevels()).length
  const matches = [...myLikes]
    .map((id) => byId.get(id))
    .filter((t): t is Profile => !!t && (t.coffeeLikes ?? []).includes(meId))
    .map((t) => ({ ...t, unlock: computeUnlock(t, total) }))
  res.json({ ok: true, matches })
}))

const MAX_PINS = 3
// «Избранные» — мои исходящие лайки, которые ещё НЕ стали мэтчем (ожидают).
// Закреплённые (до 3) идут наверху. Каждый профиль помечен флагом pinned.
app.get('/api/coffee/pending', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const meId = String(user.id)
  const byId = new Map(onlyMembers(await store.list()).map((p) => [p.userId, p]))
  const me = await pruneExpiredRequests(await store.get(meId), byId)
  const myLikes = me?.coffeeLikes ?? []
  const pins = (me?.coffeePins ?? []).filter((id) => myLikes.includes(id))
  const total = (await getLevels()).length
  const pending = myLikes
    .map((id) => byId.get(id))
    // только те, кто ещё НЕ лайкнул меня в ответ (мэтч ушёл бы во вкладку «Мэтчи»)
    .filter((t): t is Profile => !!t && !(t.coffeeLikes ?? []).includes(meId))
    .map((t) => ({ ...stripTelegram(t), unlock: computeUnlock(t, total), pinned: pins.includes(t.userId) }))
  // Закреплённые — в порядке pins, затем остальные.
  pending.sort((a, b) => {
    const pa = pins.indexOf(a.userId), pb = pins.indexOf(b.userId)
    if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
    return 0
  })
  res.json({ ok: true, pending, pins, maxPins: MAX_PINS })
}))

// Закрепить / открепить участника в «Избранных» (максимум 3 закрепа).
app.post('/api/coffee/pin', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const meId = String(user.id)
  const body = (req.body ?? {}) as { targetId?: string; pinned?: boolean }
  const targetId = String(body.targetId ?? '')
  if (!targetId) return res.status(400).json({ ok: false, error: 'bad_target' })
  const me = (await store.get(meId)) ?? ({ userId: meId } as Profile)
  const pins = (me.coffeePins ?? []).filter((id) => id !== targetId)
  if (body.pinned) {
    if (pins.length >= MAX_PINS) return res.status(409).json({ ok: false, error: 'pin_limit', maxPins: MAX_PINS })
    pins.unshift(targetId) // новый закреп — в начало
  }
  await store.upsert(meId, { coffeePins: pins.slice(0, MAX_PINS) })
  res.json({ ok: true, pins })
}))

// ── Регистрация на «Эфир в клубе» ────────────────────────────────────────────
// Вместо прямой ссылки на комнату — форма (имя + авто-ник Telegram). Жмёт
// «Войти» → сохраняем запись за пользователем (для админ-списка/аналитики) +
// шлём DM админам, и только потом отдаём ссылку на комнату для редиректа.
app.post('/api/efir/register', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const name = String((req.body as Record<string, unknown>)?.name ?? '').trim().slice(0, 120)
  if (!name) return res.status(400).json({ ok: false, error: 'name_required' })
  const meId = String(user.id)
  const dateKey = nextEfirDateKey()
  const prev = await store.get(meId)
  const regs = { ...(prev?.efirRegs ?? {}) }
  regs[dateKey] = { name, username: user.username, ts: Date.now() }
  await store.upsert(meId, { efirRegs: regs })
  sendEfirRegistrationAlert(name, user.username, dateKey, EFIR_TIME).catch(() => {})
  res.json({ ok: true, dateKey })
}))

// Список зарегистрировавшихся на эфир (админ). ?date=YYYY-MM-DD — по умолчанию
// ближайший эфир.
app.get('/api/admin/efir', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const dateKey = String(req.query.date ?? '').trim() || nextEfirDateKey()
  const regs = onlyMembers(await store.list())
    .filter((p) => p.efirRegs?.[dateKey])
    .map((p) => ({ userId: p.userId, ...p.efirRegs![dateKey] }))
    .sort((a, b) => a.ts - b.ts)
  res.json({ ok: true, date: dateKey, time: EFIR_TIME, registrations: regs })
}))

// ── Браузерная админка (deploy в apk-lab) ────────────────────────────────────

// Анти-брутфорс логина: N неудач с одного IP → временная блокировка. In-memory
// (на инстанс) — достаточная преграда для перебора пароля; сбрасывается успехом.
const LOGIN_MAX_FAILS = 6
const LOGIN_LOCK_MS = 10 * 60 * 1000
const loginGuard = new Map<string, { fails: number; until: number }>()
function clientIp(req: express.Request): string {
  const xf = (req.headers['x-forwarded-for'] as string | undefined) ?? ''
  return xf.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
}

// Вход по паролю. Возвращает токен (= пароль), который админка хранит локально
// и шлёт в заголовке x-admin-token. Отдельная авторизация от Telegram.
app.post('/api/admin/login', (req, res) => {
  const ip = clientIp(req)
  const now = Date.now()
  let g = loginGuard.get(ip)
  if (g && g.until && g.until < now) g = undefined // блокировка истекла — сброс
  g = g ?? { fails: 0, until: 0 }
  if (g.until > now) {
    const mins = Math.ceil((g.until - now) / 60000)
    return res.status(429).json({ ok: false, error: `Слишком много попыток. Повторите через ~${mins} мин.` })
  }
  const password = String((req.body as Record<string, unknown>)?.password ?? '')
  if (!ADMIN_PASSWORD) return res.status(503).json({ ok: false, error: 'Админка не настроена (нет ADMIN_PASSWORD)' })
  if (!safeEqual(password, ADMIN_PASSWORD)) {
    g.fails++
    if (g.fails >= LOGIN_MAX_FAILS) g.until = now + LOGIN_LOCK_MS
    loginGuard.set(ip, g)
    return res.status(401).json({ ok: false, error: 'Неверный пароль' })
  }
  loginGuard.delete(ip) // успех — сбрасываем счётчик
  res.json({ ok: true, token: ADMIN_PASSWORD })
})

// Проверка валидности сохранённого токена (для авто-логина админки).
app.get('/api/admin/check', ah(async (req, res) => {
  res.json({ ok: await isAdminRequest(req) })
}))

// Бэкофилл @username через бота для тех участников, у кого его ещё нет (в базе
// только числовой tg-id). Нужен для НАДЁЖНОЙ ссылки на директ в админке
// (tg://user?id=… открывает «Избранное»; https://t.me/<username> — прямо в чат).
// attempted — чтобы в рамках инстанса не дёргать getChat повторно для тех, у кого
// username в Telegram реально нет. Найденное сразу сохраняем в профиль.
const usernameAttempted = new Set<string>()
async function backfillUsernames(members: Profile[]): Promise<void> {
  const targets = members.filter(
    (m) => !m.username && /^\d+$/.test(m.userId) && !usernameAttempted.has(m.userId),
  )
  await Promise.all(
    targets.map(async (m) => {
      usernameAttempted.add(m.userId)
      const uname = await fetchUsername(m.userId)
      if (uname) {
        m.username = uname // мутируем объект списка — попадёт в ответ сразу
        await store.upsert(m.userId, { username: uname })
      }
    }),
  )
}

// Список ВСЕХ профилей (включая скрытые) — для админки.
app.get('/api/admin/profiles', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const all = onlyMembers(await store.list())
  await backfillUsernames(all)
  const total = (await getLevels()).length
  const enriched = all.map((p) => ({ ...p, unlock: computeUnlock(p, total), access: computeAccess(p) }))
  res.json({ ok: true, profiles: enriched })
}))

// Создание участника вручную. Если передан userId (напр., реальный Telegram-id) —
// профиль сам «подхватится» при первом входе этого пользователя; иначе даём
// синтетический id (m<timestamp>), Telegram-привязка появится позже.
app.post('/api/admin/profile', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const body = (req.body ?? {}) as Record<string, unknown>
  let id = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!id) id = `m${Date.now()}`
  if (isReserved(id)) return res.status(400).json({ ok: false, error: 'Недопустимый id' })
  const exists = await store.get(id)
  if (exists) return res.status(409).json({ ok: false, error: 'Участник с таким id уже есть' })
  const patch = sanitizeAdminPatch(body)
  const saved = await store.upsert(id, { ...patch, activatedAt: Date.now(), createdBy: 'admin' })
  const total = (await getLevels()).length
  res.json({ ok: true, profile: { ...saved, unlock: computeUnlock(saved, total), access: computeAccess(saved) } })
}))

// Удаление профиля (напр., чистка демо-резидентов).
app.delete('/api/admin/profile/:id', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  await store.remove(String(req.params.id))
  res.json({ ok: true })
}))

// Редактирование любого профиля (поля, прогресс, достижения).
app.put('/api/admin/profile/:id', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  // Админ может править обычные поля + управлять прогрессом.
  const patch = sanitizeAdminPatch(req.body)
  // Абсолютная установка этапа: {"setMonth": 6} — «установить 6 месяцев».
  // Переводим в bonusMonths относительно авто-отсчёта, чтобы прогресс дальше шёл сам.
  const body = req.body as Record<string, unknown>
  const total = (await getLevels()).length
  if (typeof body?.setMonth === 'number') {
    const existing = await store.get(String(req.params.id))
    const activatedAt = patch.activatedAt ?? existing?.activatedAt ?? Date.now()
    const elapsed = monthsBetween(activatedAt, Date.now())
    const target = Math.max(0, Math.min(total, Math.floor(body.setMonth as number)))
    patch.bonusMonths = Math.max(-24, Math.min(24, target - elapsed))
  }
  const saved = await store.upsert(String(req.params.id), patch)
  res.json({ ok: true, profile: saved, unlock: computeUnlock(saved, total), access: computeAccess(saved) })
}))

// ── Витрина клуба: перки, открываемые за звёзды-достижения ────────────────────
// Хранится в служебной записи __showcase (та же таблица, без DDL).
async function loadPerks(): Promise<Perk[]> {
  const row = (await store.get(SHOWCASE_KEY)) as unknown as { perks?: Perk[] } | null
  return Array.isArray(row?.perks) ? (row!.perks as Perk[]) : DEFAULT_PERKS
}

function sanitizePerks(input: unknown): Perk[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => ({
      stars: Math.max(0, Math.min(999, Math.floor(Number(p.stars) || 0))),
      title: String(p.title ?? '').slice(0, 200),
      icon: String(p.icon ?? '🎁').slice(0, 8),
    }))
    .filter((p) => p.title.length > 0)
    .slice(0, 100)
}

// Публичный список перков (для Mini App и админки).
app.get('/api/showcase', ah(async (_req, res) => {
  res.json({ ok: true, perks: await loadPerks() })
}))

// Сохранение перков витрины (админ).
app.put('/api/admin/showcase', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const perks = sanitizePerks((req.body as Record<string, unknown>)?.perks)
  await store.upsert(SHOWCASE_KEY, { perks } as unknown as Partial<Profile>)
  res.json({ ok: true, perks })
}))

// ── Каталог ресурсов (для «Доступ к ресурсам» — выбор из выпадающего списка) ───
async function loadResources(): Promise<string[]> {
  const row = (await store.get(RESOURCES_KEY)) as unknown as { list?: string[] } | null
  return Array.isArray(row?.list) ? (row!.list as string[]) : DEFAULT_RESOURCES
}
function sanitizeResources(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  return input
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().slice(0, 120))
    .filter((x) => x && !seen.has(x) && (seen.add(x), true))
    .slice(0, 100)
}
app.get('/api/admin/resources', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  res.json({ ok: true, resources: await loadResources() })
}))
app.put('/api/admin/resources', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const resources = sanitizeResources((req.body as Record<string, unknown>)?.resources)
  await store.upsert(RESOURCES_KEY, { list: resources } as unknown as Partial<Profile>)
  res.json({ ok: true, resources })
}))

// ── Список допущенных email (гейт входа) ─────────────────────────────────────
const normEmail = (e: unknown) => String(e ?? '').trim().toLowerCase()
async function loadAllowlist(): Promise<string[]> {
  const row = (await store.get(ALLOWLIST_KEY)) as unknown as { emails?: string[] } | null
  return Array.isArray(row?.emails) ? (row!.emails as string[]) : []
}
function sanitizeEmails(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  return input
    .map((x) => normEmail(x))
    .filter((x) => EMAIL_RE.test(x) && !seen.has(x) && (seen.add(x), true))
    .slice(0, 5000)
}
app.get('/api/admin/allowlist', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  res.json({ ok: true, emails: await loadAllowlist() })
}))
app.put('/api/admin/allowlist', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const emails = sanitizeEmails((req.body as Record<string, unknown>)?.emails)
  await store.upsert(ALLOWLIST_KEY, { emails } as unknown as Partial<Profile>)
  res.json({ ok: true, emails })
}))

// ── Уведомления о событиях в бота (DM резидентам) ─────────────────────────────
const EVENT_IDS = new Set(EVENT_DEFS.map((d) => d.id))

// Конфиг + ближайшие события + число получателей (для раздела «Уведомления»).
app.get('/api/admin/notifications', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const [config, upcoming, recs] = await Promise.all([
    loadNotifConfig(), upcomingEvents(7), notifRecipients(),
  ])
  res.json({
    ok: true,
    config,
    upcoming,
    recipients: recs.length,
    botReady: Boolean(BOT_TOKEN),
    events: EVENT_DEFS.map((d) => ({ id: d.id, title: d.title, time: d.time ?? null })),
  })
}))

// Сохранить настройки (рубильник, шаблоны, час отправки).
app.put('/api/admin/notifications', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const config = await updateNotifConfig(req.body)
  res.json({ ok: true, config })
}))

// Ручная отправка анонса события (гибрид-режим).
app.post('/api/admin/notifications/send', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const body = (req.body ?? {}) as { eventId?: string; dateKey?: string; force?: boolean; offset?: number }
  if (!body.eventId || !EVENT_IDS.has(body.eventId as EventId)) {
    return res.status(400).json({ ok: false, error: 'bad_event' })
  }
  if (!body.dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateKey)) {
    return res.status(400).json({ ok: false, error: 'bad_date' })
  }
  const offset = typeof body.offset === 'number' ? body.offset : 0
  const report = await sendNotifEvent(body.eventId as EventId, body.dateKey, { force: Boolean(body.force), offset })
  res.json({ ok: report.ok, report })
}))

// Произвольное уведомление — рассылка всем резидентам (текст + опц. картинка).
// Резюмируемо: offset позволяет продолжить длинную рассылку (клиент шлёт в цикле).
app.post('/api/admin/notifications/send-custom', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const body = (req.body ?? {}) as { text?: string; image?: string; offset?: number }
  const offset = typeof body.offset === 'number' ? body.offset : 0
  const report = await sendNotifCustom(String(body.text ?? ''), body.image, offset)
  res.json({ ok: report.ok, report })
}))

// Статус бота в канале (админ, права постить/закреплять).
app.get('/api/admin/channel', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  res.json({ ok: true, status: await channelStatus() })
}))

// Опубликовать приветствие в канал и закрепить (админ).
app.post('/api/admin/channel/publish', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const result = await publishChannelEntry()
  res.json(result)
}))

// Опубликовать произвольный анонс в канал (текст + опц. картинка) с кнопкой —
// свои текст+ссылка (buttonText/buttonUrl), либо дефолт «Войти» → мини-приложение,
// если не заданы. Не закрепляется — обычный пост.
app.post('/api/admin/channel/publish-custom', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const body = (req.body ?? {}) as { text?: string; image?: string; buttonText?: string; buttonUrl?: string }
  const text = String(body.text ?? '').trim().slice(0, 4000)
  const image = typeof body.image === 'string' ? body.image : undefined
  const buttonText = typeof body.buttonText === 'string' ? body.buttonText.trim().slice(0, 60) : undefined
  const buttonUrl = typeof body.buttonUrl === 'string' ? body.buttonUrl.trim().slice(0, 500) : undefined
  if (!text && !image) return res.json({ ok: false, posted: false, error: 'empty' })
  res.json(await publishChannelCustom(text, image, buttonText, buttonUrl))
}))

// ── Бот: webhook (serverless) + установка вебхука ─────────────────────────────
// Telegram шлёт сюда апдейты в webhook-режиме (Vercel). Отвечаем 200 быстро.
app.post('/api/telegram/webhook', ah(async (req, res) => {
  try { await handleUpdate(req.body ?? {}) } catch (e) { console.error('[bot] webhook:', (e as Error)?.message) }
  res.json({ ok: true })
}))

// Установить webhook на указанный URL (админ). Вызывается один раз после деплоя.
app.post('/api/admin/bot/webhook', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const url = String((req.body as { url?: string })?.url ?? '').trim()
  if (!/^https:\/\/.+/.test(url)) return res.status(400).json({ ok: false, error: 'bad_url' })
  res.json(await setWebhook(url))
}))

// ── Cron: рассылка уведомлений по расписанию ──────────────────────────────────
// Дёргается по расписанию (Vercel Cron или внешний пингер ежечасно). Защита секретом.
const CRON_SECRET = process.env.CRON_SECRET ?? ''
app.all('/api/cron/notify', ah(async (req, res) => {
  const provided = String(req.query.secret ?? '') || (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (CRON_SECRET && !safeEqual(provided, CRON_SECRET)) return res.status(401).json({ ok: false, error: 'unauthorized' })
  await runDueNotifications()
  await flushFollowups() // разослать «дозревшие» отложенные вторые сообщения
  res.json({ ok: true, ranAt: new Date().toISOString() })
}))

// Тестовое сообщение на указанный chat_id (проверка бота). Опц. buttonText/buttonUrl —
// для проверки анонса «В канал» (текст+кнопка) до публикации.
app.post('/api/admin/notifications/test', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const body = (req.body ?? {}) as { chatId?: string | number; text?: string; image?: string; buttonText?: string; buttonUrl?: string }
  if (!body.chatId) return res.status(400).json({ ok: false, error: 'no_chat_id' })
  const result = (body.buttonText || body.buttonUrl)
    ? await sendTestWithButton(String(body.chatId), body.text?.trim() || '🔔 Тестовое уведомление из админки APClub.', body.image, body.buttonText, body.buttonUrl)
    : await sendNotifTest(String(body.chatId), body.text, body.image)
  res.json(result)
}))

// ── Трекинг запусков приложения + статистика для дашборда ─────────────────────

// Фиксируем запуск приложения: обновляем активность пользователя и суточный
// счётчик запусков. Вызывается мини-приложением один раз при старте.
app.post('/api/launch', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const id = String(user.id)
  const now = Date.now()
  const today = dayKey(now)
  const mk = ymKey(now)
  const prev = await store.get(id)
  // Счётчики запусков — на СВОЕЙ строке (раньше был общий __stats → lost-update
  // при массовом наплыве). Каждый пишет только свою запись, кросс-гонки нет.
  const launchDays = { ...(prev?.launchDays ?? {}) }
  launchDays[today] = (launchDays[today] ?? 0) + 1
  // Держим только последние ~40 дней (дашборду нужно 14) — чтобы не рос бесконечно.
  const keepDays = new Set(Array.from({ length: 40 }, (_, i) => dayKey(now - i * DAY_MS)))
  for (const k of Object.keys(launchDays)) if (!keepDays.has(k)) delete launchDays[k]
  const activeMonths = prev?.activeMonths?.includes(mk)
    ? prev.activeMonths
    : [...(prev?.activeMonths ?? []), mk].slice(-12)
  const patch: Partial<Profile> = {
    lastSeenAt: now,
    firstSeenAt: prev?.firstSeenAt ?? now,
    launchCount: (prev?.launchCount ?? 0) + 1,
    launchDays,
    activeMonths,
  }
  // Сохраняем Telegram @username (для ссылки на директ в админке) — при входе
  // он есть в initData. Не user-editable, поэтому пишем сюда, а не в форме.
  if (user.username && user.username !== prev?.username) patch.username = user.username
  // activeDays растёт только на новый календарный день (для вовлечённости).
  if (prev?.lastActiveDay !== today) {
    patch.activeDays = (prev?.activeDays ?? 0) + 1
    patch.lastActiveDay = today
  }
  await store.upsert(id, patch)
  res.json({ ok: true })
}))

// Агрегированная статистика для дашборда (админ).
app.get('/api/admin/stats', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const now = Date.now()
  const members = onlyMembers(await store.list())
  const total = members.length
  const activated = members.filter((m) => typeof m.lastSeenAt === 'number')
  const active = activated.filter((m) => now - (m.lastSeenAt as number) <= 7 * DAY_MS)
  const churned = activated.filter((m) => now - (m.lastSeenAt as number) > 30 * DAY_MS)
  const engaged = members.filter((m) => (m.activeDays ?? 0) >= 3)
  const base = activated.length
  const retention = base ? Math.round((active.length / base) * 100) : 100
  const churnRate = base ? Math.round((churned.length / base) * 100) : 0

  // Ряд запусков за 14 дней. Источник — launchDays на строках участников (новое,
  // без гонок) + старый общий __stats (legacy, чтобы не потерять историю до перехода).
  // Каждый запуск писался ровно в одно место (до перехода — в __stats, после — в
  // launchDays), поэтому суммирование не даёт двойного счёта.
  const legacy = (await store.get(STATS_KEY)) as unknown as
    { daily?: Record<string, number>; monthly?: Record<string, string[]> } | null
  const legacyDaily = legacy?.daily ?? {}
  const legacyMonthly = legacy?.monthly ?? {}
  const launchesOn = (day: string): number => {
    let n = legacyDaily[day] ?? 0
    for (const m of members) n += m.launchDays?.[day] ?? 0
    return n
  }
  const series: { date: string; launches: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(now - i * DAY_MS)
    series.push({ date: key, launches: launchesOn(key) })
  }
  // Всего запусков (all-time) — сумма launchCount участников (тоже без гонок).
  const totalLaunches = members.reduce((s, m) => s + (m.launchCount ?? 0), 0)
  const todayLaunches = launchesOn(dayKey(now))

  // Тренды retention/churn по месяцам (6 месяцев). Считаем месяц-к-месяцу:
  // retention(M) = доля активных прошлого месяца, вернувшихся в этом.
  // Набор активных за месяц = legacy __stats.monthly ∪ участники с этим месяцем
  // в activeMonths.
  const activeSet = (ym: string): Set<string> => {
    const s = new Set<string>(legacyMonthly[ym] ?? [])
    for (const m of members) if (m.activeMonths?.includes(ym)) s.add(m.userId)
    return s
  }
  const retentionSeries: { period: string; value: number | null }[] = []
  const churnSeries: { period: string; value: number | null }[] = []
  for (let i = 5; i >= 0; i--) {
    const cur = ymKey(now, -i)
    const prevKey = ymKey(now, -i - 1)
    const prevActive = [...activeSet(prevKey)]
    const curSet = activeSet(cur)
    let ret: number | null = null
    if (prevActive.length) {
      const returned = prevActive.filter((u) => curSet.has(u)).length
      ret = Math.round((returned / prevActive.length) * 100)
    }
    retentionSeries.push({ period: cur, value: ret })
    churnSeries.push({ period: cur, value: ret === null ? null : 100 - ret })
  }

  res.json({
    ok: true,
    total,
    active: active.length,
    inactive: total - active.length,
    engaged: engaged.length,
    retention,
    churnRate,
    launches: { series, total: totalLaunches, today: todayLaunches },
    retentionSeries,
    churnSeries,
  })
}))

// ── Бадди (Random coffee): выбор напарника раз в месяц ────────────────────────
function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Текущий бадди месяца (если уже выбран)
app.get('/api/buddy', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const me = await store.get(String(user.id))
  const month = monthKey()
  if (me?.buddy && me.buddy.month === month) {
    const buddy = await store.get(me.buddy.userId)
    return res.json({ ok: true, month, chosen: true, buddy: buddy ?? null })
  }
  res.json({ ok: true, month, chosen: false, buddy: null })
}))

// Выбрать бадди на текущий месяц. Раз в месяц: если уже выбран — вернуть его.
app.post('/api/buddy', ah(async (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
  const meId = String(user.id)
  const me = await store.get(meId)
  const month = monthKey()
  if (me?.buddy && me.buddy.month === month) {
    const buddy = await store.get(me.buddy.userId)
    // Если выбранный ранее бадди ещё существует — возвращаем его. Если профиль
    // пропал (удалён) — НЕ отдаём null, а перевыбираем ниже.
    if (buddy && !isReserved(buddy.userId)) {
      return res.json({ ok: true, month, alreadyChosen: true, buddy })
    }
  }
  // Кандидаты — все видимые зарегистрированные резиденты, кроме самого себя
  const all = onlyMembers(await store.list())
  const candidates = all.filter((p) => p.userId !== meId && p.showProfile !== false && p.registeredAt)
  if (candidates.length === 0) {
    return res.json({ ok: true, month, alreadyChosen: false, buddy: null, empty: true })
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  await store.upsert(meId, { buddy: { month, userId: pick.userId } })
  res.json({ ok: true, month, alreadyChosen: false, buddy: pick })
}))

const buddyName = (p?: Profile | null) => (p ? (`${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.userId) : '')
// Геймификация для админа: список резидентов + их бадди месяца (редактируемо) +
// взаимные мэтчи нетворкинга (для вкладки «Нетворкинг»).
app.get('/api/admin/pairs', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const all = onlyMembers(await store.list())
  const byId = new Map(all.map((p) => [p.userId, p]))
  const month = monthKey()
  const curBuddy = (p?: Profile | null) => (p?.buddy && p.buddy.month === month ? p.buddy.userId : '')
  const members = all
    .filter((p) => p.registeredAt)
    .map((p) => {
      const bid = curBuddy(p)
      const b = bid ? byId.get(bid) : null
      // Пара «требует корректировки», если бадди нет ИЛИ он не отвечает взаимностью.
      const needsFix = !b || curBuddy(b) !== p.userId
      return { id: p.userId, name: buddyName(p), buddyId: b ? bid : '', buddyName: buddyName(b), needsFix }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  // Нетворкинг: по каждому резиденту — исходящие запросы со статусом (мэтч / ожидает).
  const networking = all
    .filter((p) => p.registeredAt)
    .map((p) => ({
      id: p.userId,
      name: buddyName(p),
      sent: (p.coffeeLikes ?? [])
        .map((id) => byId.get(id))
        .filter((t): t is Profile => !!t && !isReserved(t.userId))
        .map((t) => ({ name: buddyName(t), matched: (t.coffeeLikes ?? []).includes(p.userId) })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  res.json({ ok: true, members, networking })
}))

// Изменить бадди — ВЗАИМНО (A↔B). buddyId '' → авто (предпочитая свободных),
// <id> → вручную, null → снять. Прежние партнёры обоих освобождаются.
app.post('/api/admin/buddy', ah(async (req, res) => {
  if (!(await requireAdmin(req, res))) return
  const body = (req.body ?? {}) as { userId?: string; buddyId?: string | null }
  const uid = String(body.userId ?? '')
  if (!uid || isReserved(uid)) return res.status(400).json({ ok: false, error: 'bad_user' })
  const month = monthKey()
  const all = onlyMembers(await store.list())
  const byId = new Map(all.map((p) => [p.userId, p]))
  const curBuddy = (p?: Profile | null) => (p?.buddy && p.buddy.month === month ? p.buddy.userId : '')
  // Разорвать пару человека id и освободить его партнёра.
  const unpair = async (id: string) => {
    const p = byId.get(id); if (!p) return
    const partnerId = curBuddy(p)
    if (partnerId && curBuddy(byId.get(partnerId)) === id) await store.upsert(partnerId, { buddy: undefined })
    await store.upsert(id, { buddy: undefined })
  }
  if (body.buddyId === null) { await unpair(uid); return res.json({ ok: true }) }
  let bid = String(body.buddyId ?? '')
  if (!bid) {
    const elig = all.filter((p) => p.userId !== uid && p.showProfile !== false && p.registeredAt)
    const free = elig.filter((p) => !curBuddy(p)) // без пары — приоритет
    const pool = free.length ? free : elig
    if (!pool.length) return res.json({ ok: true, empty: true })
    bid = pool[Math.floor(Math.random() * pool.length)].userId
  }
  await unpair(uid)
  await unpair(bid)
  await store.upsert(uid, { buddy: { month, userId: bid } })
  await store.upsert(bid, { buddy: { month, userId: uid } })
  res.json({ ok: true, buddyId: bid, buddyName: buddyName(byId.get(bid)) })
}))

// ── Запуск ────────────────────────────────────────────────────────────────────
// На Vercel (serverless) НЕ слушаем порт, НЕ крутим setInterval и НЕ поллим —
// там работают webhook (/api/telegram/webhook) и cron (/api/cron/notify).
// Локально — обычный сервер: listen + планировщик + long-polling бота.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 API server on http://localhost:${PORT}`)
  })
  const NOTIFY_INTERVAL_MS = 5 * 60 * 1000
  setInterval(() => {
    runDueNotifications().catch((e) => console.error('[notify] scheduler error:', e?.message ?? e))
  }, NOTIFY_INTERVAL_MS)
  // Отложенные вторые сообщения (канал+поддержка) — проверяем чаще, чтобы 3-мин
  // задержка была точнее в локальном/долгоживущем режиме.
  setInterval(() => {
    flushFollowups().catch((e) => console.error('[followup] scheduler error:', e?.message ?? e))
  }, 30 * 1000)
  startBot()
}

// Экспорт Express-приложения как serverless-хендлера (Vercel: server/api/index.ts).
export default app
