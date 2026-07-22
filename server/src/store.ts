import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SupabaseProfileStore } from './supabaseStore.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Хранилище профилей резидентов APClub.
//
// Сейчас — простое файловое хранилище (data/profiles.json): одна общая «база»
// на сервере, доступная всем пользователям и будущей админке.
//
// Абстракция ProfileStore специально отделена от роутов: чтобы перейти на
// настоящую БД (Supabase/Postgres) достаточно реализовать этот же интерфейс —
// роуты в index.ts менять не придётся.
// ─────────────────────────────────────────────────────────────────────────────

export type ProfileSocial = {
  instagram?: string
  linkedin?: string
  telegram?: string
  web?: string
}

// Профиль, редактируемый пользователем. Все поля опциональны.
export type Profile = {
  userId: string
  firstName?: string
  lastName?: string
  username?: string
  avatar?: string
  city?: string
  birthDate?: string
  about?: string
  maritalStatus?: string
  occupation?: string // основная профессиональная деятельность
  // Новый (упрощённый) набор полей профиля:
  focus?: string // текущий фокус («сейчас в фокусе»)
  strategies?: string // стратегии, на которых сосредоточен
  directions?: string // направления
  topics?: string // темы для обсуждения
  offer?: string // что может предложить
  avgResult?: string // средний результат за месяц
  maxResult?: string // максимальный результат за месяц
  // Устаревшие (оставлены для обратной совместимости, в форме больше не редактируются):
  strengths?: string
  weaknesses?: string
  canHelp?: string
  social?: ProfileSocial
  allowMessages?: boolean
  showProfile?: boolean
  // Прогресс разблокировки по месяцам (авто по времени + ручная корректировка):
  activatedAt?: number // дата активации (первый вход / ручное создание) — с неё идёт авто-отсчёт
  bonusMonths?: number // ручная корректировка админа (± месяцев к авто-отсчёту)
  accessUntil?: number // срок доступа (timestamp) = дата следующего платежа. По истечении вход закрыт
  billingPeriod?: 'monthly' | 'quarterly' | 'semiannual' | 'annual' // периодичность оплаты резидента
  grants?: string[] // ручные доступы к ресурсам (выдаёт админ поверх уровней)
  achievements?: string[] // id полученных money-ачивок (выдаёт админ/система). Каждая = +1 звезда
  roleTiers?: Record<string, number> // прогресс по ролям: roleId → тир 0..5. Тир 5 = +1 звезда (тиры 1–4 — только прогресс)
  buddy?: { month: string; userId: string } // выбранный бадди на месяц (раз в месяц)
  // Нетворкинг «рандом-кофе» (тиндер-свайпы): кого лайкнул / пропустил.
  // Взаимный лайк = мэтч. Заполняется эндпоинтами /api/coffee/*, не в форме.
  coffeeLikes?: string[]
  coffeePasses?: string[]
  coffeePins?: string[] // закреплённые в «Избранных» (максимум 3, наверху списка)
  coffeeLikeAt?: Record<string, number> // когда отправлен запрос (для недельного лимита 5)
  createdBy?: 'admin' | 'telegram' // как заведён профиль (ручное создание в админке / вход из Telegram)
  isAdmin?: boolean // назначен админом из веб-панели → доступ к админке из мобильного приложения
  // Активность (трекинг запусков приложения) — заполняется сервером, не пользователем:
  firstSeenAt?: number // первый запуск
  lastSeenAt?: number // последний запуск
  launchCount?: number // всего запусков
  activeDays?: number // на скольких разных днях запускал (для вовлечённости)
  lastActiveDay?: string // последний день активности (YYYY-MM-DD) для подсчёта activeDays
  // Запуски по дням на СВОЕЙ строке (вместо общего __stats — без гонки при наплыве).
  // Прунится до последних ~40 дней. Дашборд суммирует по всем участникам.
  launchDays?: Record<string, number> // { 'YYYY-MM-DD': count }
  activeMonths?: string[] // месяцы активности 'YYYY-MM' (для retention/churn)
  // Отложенное второе сообщение бота (канал+поддержка) через ~3 мин после welcome.
  followupDueAt?: number | null // когда отправить (ts); null/absent — не запланировано
  followupSent?: boolean // уже отправлено (одноразово на пользователя)
  // Регистрация (гейт входа): заполняется при первом онбординге в мини-аппе.
  email?: string // почта — для проверки доступа на платформе
  registeredAt?: number // момент завершения регистрации (есть → онбординг пройден)
  updatedAt?: number
  // Регистрации на «Эфир в клубе» (Чт 19:00 МСК): ключ — дата эфира (YYYY-MM-DD,
  // МСК). Заполняется формой входа в мини-аппе, не пользователем напрямую.
  efirRegs?: Record<string, { name: string; username?: string; ts: number }>
}

// Поля, которые пользователь может изменять сам (без служебных userId/updatedAt).
export const EDITABLE_FIELDS: (keyof Profile)[] = [
  'firstName',
  'lastName',
  'email',
  'avatar',
  'city',
  'occupation',
  'focus',
  'strategies',
  'directions',
  'topics',
  'offer',
  'avgResult',
  'maxResult',
  'social',
  'allowMessages',
  'showProfile',
  // устаревшие (совместимость):
  'birthDate',
  'about',
  'maritalStatus',
  'strengths',
  'weaknesses',
  'canHelp',
]

export interface ProfileStore {
  get(userId: string): Promise<Profile | null>
  list(): Promise<Profile[]>
  upsert(userId: string, patch: Partial<Profile>): Promise<Profile>
  remove(userId: string): Promise<void>
  // Лёгкий гейт регистрации: userId зарегистрированного профиля с этой
  // (нормализованной) почтой, кроме excludeUserId. НЕ тянет avatar/полные
  // профили. null — почта свободна. Заменяет тяжёлый list() в /register.
  emailOwner(emailNorm: string, excludeUserId: string): Promise<string | null>
  // Лёгкий список userId, у кого followupDueAt наступил (<= now) — для отправки
  // отложенного второго сообщения. Проекция без avatar/полных профилей.
  dueFollowups(now: number): Promise<string[]>
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '..', 'data')
const DATA_FILE = path.join(DATA_DIR, 'profiles.json')

class FileProfileStore implements ProfileStore {
  private cache: Record<string, Profile> | null = null
  private writing: Promise<void> = Promise.resolve()

  private async load(): Promise<Record<string, Profile>> {
    if (this.cache) return this.cache
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8')
      this.cache = JSON.parse(raw) as Record<string, Profile>
    } catch {
      this.cache = {}
    }
    return this.cache
  }

  private async persist(): Promise<void> {
    const data = this.cache ?? {}
    // Сериализуем записи, чтобы параллельные upsert не перетирали друг друга.
    this.writing = this.writing.then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8')
    })
    return this.writing
  }

  async get(userId: string): Promise<Profile | null> {
    const all = await this.load()
    return all[userId] ?? null
  }

  async list(): Promise<Profile[]> {
    const all = await this.load()
    return Object.values(all)
  }

  async upsert(userId: string, patch: Partial<Profile>): Promise<Profile> {
    const all = await this.load()
    const prev = all[userId] ?? { userId }
    const next: Profile = { ...prev, ...patch, userId, updatedAt: Date.now() }
    all[userId] = next
    await this.persist()
    return next
  }

  async remove(userId: string): Promise<void> {
    const all = await this.load()
    if (userId in all) {
      delete all[userId]
      await this.persist()
    }
  }

  async emailOwner(emailNorm: string, excludeUserId: string): Promise<string | null> {
    const all = await this.load()
    for (const [uid, p] of Object.entries(all)) {
      if (uid === excludeUserId || uid.startsWith('__')) continue
      if (p.registeredAt && String(p.email ?? '').trim().toLowerCase() === emailNorm) return uid
    }
    return null
  }

  async dueFollowups(now: number): Promise<string[]> {
    const all = await this.load()
    const out: string[] = []
    for (const [uid, p] of Object.entries(all)) {
      if (uid.startsWith('__')) continue
      if (typeof p.followupDueAt === 'number' && p.followupDueAt <= now) out.push(uid)
    }
    return out
  }
}

// Выбор бэкенда: Supabase, если заданы креды, иначе файловое хранилище.
function createStore(): ProfileStore {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (url && key) {
    console.log('🗄  Хранилище профилей: Supabase (Postgres)')
    return new SupabaseProfileStore(url, key)
  }
  console.log('🗄  Хранилище профилей: файловое (data/profiles.json)')
  return new FileProfileStore()
}

// Единственный экземпляр хранилища на процесс.
export const store: ProfileStore = createStore()

// Санитизация входящего патча: берём только разрешённые поля.
export function sanitizePatch(input: unknown): Partial<Profile> {
  const out: Partial<Profile> = {}
  if (!input || typeof input !== 'object') return out
  const obj = input as Record<string, unknown>
  for (const key of EDITABLE_FIELDS) {
    if (!(key in obj)) continue
    const v = obj[key]
    if (key === 'social' && v && typeof v === 'object') {
      const s = v as Record<string, unknown>
      out.social = {
        instagram: str(s.instagram),
        linkedin: str(s.linkedin),
        telegram: str(s.telegram),
        web: str(s.web),
      }
    } else if (key === 'allowMessages' || key === 'showProfile') {
      out[key] = Boolean(v)
    } else if (key === 'avatar') {
      // Аватар может быть data:URL (base64) — не режем как обычную строку.
      if (typeof v === 'string') out.avatar = v.slice(0, 3_000_000)
    } else if (typeof v === 'string') {
      // @ts-ignore — строковые поля профиля
      out[key] = v.slice(0, 2000)
    }
  }
  return out
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, 500) : ''
}

// Патч от админа: обычные поля + управление прогрессом (activatedAt, bonusMonths).
// Прогресс идёт автоматически по времени с activatedAt; bonusMonths — ручная
// корректировка админа (±). Пользователь эти поля менять не может.
export function sanitizeAdminPatch(input: unknown): Partial<Profile> {
  const out = sanitizePatch(input)
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>
    if (typeof obj.activatedAt === 'number') out.activatedAt = obj.activatedAt
    if (typeof obj.bonusMonths === 'number') {
      out.bonusMonths = Math.max(-24, Math.min(24, Math.floor(obj.bonusMonths)))
    }
    // Срок доступа: number = timestamp, null = снять ограничение (бессрочно).
    if (obj.accessUntil === null) out.accessUntil = undefined
    else if (typeof obj.accessUntil === 'number') out.accessUntil = obj.accessUntil
    // Периодичность оплаты (для диаграммы платежей на дашборде).
    if (['monthly', 'quarterly', 'semiannual', 'annual'].includes(obj.billingPeriod as string)) {
      out.billingPeriod = obj.billingPeriod as Profile['billingPeriod']
    } else if (obj.billingPeriod === null || obj.billingPeriod === '') {
      out.billingPeriod = undefined
    }
    if (Array.isArray(obj.grants)) {
      out.grants = obj.grants
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.slice(0, 200))
        .slice(0, 100)
    }
    if (Array.isArray(obj.achievements)) {
      out.achievements = obj.achievements
        .filter((x): x is string => typeof x === 'string')
        .slice(0, 100)
    }
    if (typeof obj.isAdmin === 'boolean') out.isAdmin = obj.isAdmin
    // Прогресс по ролям: { roleId: тир 0..5 }. Тир 5 даёт звезду.
    if (obj.roleTiers && typeof obj.roleTiers === 'object' && !Array.isArray(obj.roleTiers)) {
      const src = obj.roleTiers as Record<string, unknown>
      const rt: Record<string, number> = {}
      for (const id of Object.keys(src).slice(0, 100)) {
        const t = Math.max(0, Math.min(5, Math.floor(Number(src[id]) || 0)))
        if (t > 0) rt[id.slice(0, 100)] = t // тир 0 не храним — экономим место
      }
      out.roleTiers = rt
    }
    if (obj.buddy === null) out.buddy = undefined
    else if (obj.buddy && typeof obj.buddy === 'object') {
      const b = obj.buddy as Record<string, unknown>
      if (typeof b.month === 'string' && typeof b.userId === 'string') {
        out.buddy = { month: b.month, userId: b.userId }
      }
    }
  }
  return out
}
