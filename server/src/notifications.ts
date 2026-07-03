// Уведомления о событиях клуба в Telegram-бота (DM каждому резиденту).
// Режим: гибрид — авто-планировщик по расписанию МСК + ручная отправка из админки.
// Настройки хранятся в служебной записи __notifications (та же таблица profiles, без DDL).
//
// Telegram-ограничение: бот не может писать первым — резидент должен был нажать Start.
// Поэтому при отправке 403/«bot can't initiate» считаем такого получателя пропущенным,
// а не ошибкой. chat_id = Telegram user_id (= userId профиля для реальных пользователей).

import { store } from './store.ts'
import type { Profile } from './store.ts'

const NOTIF_KEY = '__notifications'
const BOT_TOKEN = process.env.BOT_TOKEN ?? ''
const RESERVED_PREFIX = '__'
const MSK_OFFSET = 3 * 3600 * 1000 // UTC+3

// ── Модель события ────────────────────────────────────────────────────────────
export type EventId = 'sreda' | 'efir' | 'birthday' | 'weekplan' | 'weeksum'

export type EventConfig = {
  enabled: boolean
  template: string // текст с плейсхолдерами {name} {time} {date}
  sendHour: number // час МСК (0..23), когда авто-планировщик шлёт анонс в день события
  image?: string // необязательный баннер (data:URL base64). Есть → шлём фото с подписью
}
// Произвольное (кастомное) уведомление — сохранённый шаблон для ручной рассылки.
export type CustomNotif = { id: string; title: string; text: string; image?: string }

export type NotifConfig = {
  enabled: boolean // общий рубильник всех уведомлений
  events: Record<EventId, EventConfig>
  custom: CustomNotif[] // сохранённые произвольные уведомления (CRUD из админки)
  sent: Record<string, number> // ключ `${eventId}:${YYYY-MM-DD}` → время отправки (дедуп)
}

// Определение расписания — зеркалит Calendar в мини-аппе.
// dow: 0=Вс..6=Сб (как Date.getUTCDay). null = событие не по дню недели (дни рождения).
type EventDef = {
  id: EventId
  title: string
  dow: number | null
  time?: string // «стенное» время МСК, подставляется в {time}
  defaultHour: number
  defaultTemplate: string
}
export const EVENT_DEFS: EventDef[] = [
  { id: 'sreda', title: 'Онлайн-среда', dow: 3, time: '15:00', defaultHour: 10,
    defaultTemplate: '🎙️ Сегодня Онлайн-среда в {time} МСК. Подключайся к эфиру резидентов!' },
  { id: 'efir', title: 'Эфир в клубе', dow: 4, time: '19:00', defaultHour: 10,
    defaultTemplate: '🎥 Сегодня Эфир в клубе в {time} МСК. Не пропусти разбор!' },
  { id: 'birthday', title: 'День рождения', dow: null, defaultHour: 9,
    defaultTemplate: '🎂 Сегодня день рождения у резидента APClub {name}! Поздравим 🎉' },
  { id: 'weekplan', title: 'План недели', dow: 1, defaultHour: 9,
    defaultTemplate: '📝 Новая неделя началась — поставь цели и план на неделю.' },
  { id: 'weeksum', title: 'Итоги недели', dow: 0, defaultHour: 20,
    defaultTemplate: '✅ Воскресенье — подведи итоги недели и отметь прогресс.' },
]
const DEF_BY_ID = Object.fromEntries(EVENT_DEFS.map((d) => [d.id, d])) as Record<EventId, EventDef>

// ── Время по МСК ──────────────────────────────────────────────────────────────
// «Стенные» часы МСК получаем через UTC-поля сдвинутой на +3ч даты.
function mskParts(ms: number) {
  const d = new Date(ms + MSK_OFFSET)
  return {
    y: d.getUTCFullYear(), mo: d.getUTCMonth(), day: d.getUTCDate(),
    hour: d.getUTCHours(), dow: d.getUTCDay(),
  }
}
function mskDateKey(ms: number): string {
  const p = mskParts(ms)
  return `${p.y}-${String(p.mo + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

// mm-dd из даты рождения (yyyy-mm-dd или dd.mm.yyyy) — как в Calendar.tsx
function bdKey(bd?: string): string | null {
  if (!bd) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(bd)) return `${bd.slice(5, 7)}-${bd.slice(8, 10)}`
  if (/^\d{2}\.\d{2}\.\d{4}/.test(bd)) return `${bd.slice(3, 5)}-${bd.slice(0, 2)}`
  return null
}
function birthdayMap(recs: Profile[]): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const p of recs) {
    const k = bdKey(p.birthDate)
    if (!k) continue
    const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Участник'
    ;(map[k] ??= []).push(name)
  }
  return map
}

function renderTemplate(tpl: string, vars: { name?: string; time?: string; date?: string }): string {
  return tpl
    .replace(/\{name\}/g, vars.name ?? '')
    .replace(/\{time\}/g, vars.time ?? '')
    .replace(/\{date\}/g, vars.date ?? '')
    .trim()
}

// ── Конфиг: загрузка/дефолты/сохранение ───────────────────────────────────────
const clampHour = (v: unknown, def: number): number => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : def
}

export function defaultConfig(): NotifConfig {
  const events = {} as Record<EventId, EventConfig>
  for (const d of EVENT_DEFS) {
    events[d.id] = { enabled: true, template: d.defaultTemplate, sendHour: d.defaultHour }
  }
  return { enabled: true, events, custom: [], sent: {} }
}

// Санитайзер списка произвольных уведомлений.
function sanitizeCustom(input: unknown): CustomNotif[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c, i) => ({
      id: String(c.id ?? '').slice(0, 40) || `c${i}`,
      title: String(c.title ?? '').slice(0, 120),
      text: String(c.text ?? '').slice(0, 1500),
      image: typeof c.image === 'string' && c.image.startsWith('data:image/') ? c.image.slice(0, 4_000_000) : undefined,
    }))
    .filter((c) => c.text.trim().length > 0 || c.image)
    .slice(0, 50)
}

export async function loadConfig(): Promise<NotifConfig> {
  const row = (await store.get(NOTIF_KEY)) as unknown as Partial<NotifConfig> | null
  const def = defaultConfig()
  if (!row) return def
  const events = {} as Record<EventId, EventConfig>
  for (const d of EVENT_DEFS) {
    const e = row.events?.[d.id]
    events[d.id] = {
      enabled: typeof e?.enabled === 'boolean' ? e.enabled : def.events[d.id].enabled,
      template: typeof e?.template === 'string' && e.template.trim() ? e.template : def.events[d.id].template,
      sendHour: clampHour(e?.sendHour, def.events[d.id].sendHour),
      image: typeof e?.image === 'string' && e.image.startsWith('data:image/') ? e.image : undefined,
    }
  }
  return {
    enabled: typeof row.enabled === 'boolean' ? row.enabled : true,
    events,
    custom: sanitizeCustom(row.custom),
    sent: (row.sent && typeof row.sent === 'object' ? row.sent : {}) as Record<string, number>,
  }
}

async function saveConfig(cfg: NotifConfig): Promise<void> {
  // Чистим старые ключи дедупа (>60 дней), чтобы sent не рос бесконечно.
  const cutoff = mskDateKey(Date.now() - 60 * 24 * 3600 * 1000)
  const sent: Record<string, number> = {}
  for (const [k, v] of Object.entries(cfg.sent)) {
    const date = k.split(':')[1] ?? ''
    if (date >= cutoff) sent[k] = v
  }
  await store.upsert(NOTIF_KEY, { ...cfg, sent } as unknown as Partial<Profile>)
}

// Обновление конфига из админки (не трогаем sent — он служебный).
export async function updateConfig(input: unknown): Promise<NotifConfig> {
  const cur = await loadConfig()
  const src = (input ?? {}) as { enabled?: unknown; events?: Record<string, unknown>; custom?: unknown }
  const next: NotifConfig = {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : cur.enabled,
    events: { ...cur.events },
    // custom заменяем целиком, если пришёл массив (полный список из админки); иначе оставляем.
    custom: Array.isArray(src.custom) ? sanitizeCustom(src.custom) : cur.custom,
    sent: cur.sent,
  }
  for (const d of EVENT_DEFS) {
    const e = src.events?.[d.id] as Partial<EventConfig> | undefined
    if (e && typeof e === 'object') {
      // image: строка data:image/... — установить; пустая строка '' — снять; undefined — оставить как было.
      let image = cur.events[d.id].image
      if (typeof e.image === 'string') {
        image = e.image.startsWith('data:image/') ? e.image.slice(0, 4_000_000) : undefined
      }
      next.events[d.id] = {
        enabled: typeof e.enabled === 'boolean' ? e.enabled : cur.events[d.id].enabled,
        template: typeof e.template === 'string' && e.template.trim()
          ? e.template.slice(0, 500) : cur.events[d.id].template,
        sendHour: clampHour(e.sendHour, cur.events[d.id].sendHour),
        image,
      }
    }
  }
  await saveConfig(next)
  return next
}

// ── Получатели ────────────────────────────────────────────────────────────────
// Реальные Telegram-резиденты (числовой userId = chat_id). Ручные профили с
// нечисловым id (m<ts>) писать нельзя — у них нет чата с ботом.
const isRealTelegramId = (id: string) => /^\d{5,}$/.test(id)
export async function recipients(): Promise<Profile[]> {
  const list = await store.list()
  return list.filter((p) => !p.userId.startsWith(RESERVED_PREFIX) && isRealTelegramId(p.userId))
}

// ── Ближайшие события (для админки) ────────────────────────────────────────────
export type Occurrence = {
  eventId: EventId
  title: string
  dateKey: string // YYYY-MM-DD (МСК)
  dateLabel: string // «02.07 (чт)»
  sendHour: number
  enabled: boolean
  message: string
  hasImage: boolean
  recipients: number
  sent: boolean
  sentAt?: number
}

const DOW_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

export async function upcoming(days = 7): Promise<Occurrence[]> {
  const cfg = await loadConfig()
  const recs = await recipients()
  const bdays = birthdayMap(recs)
  const now = Date.now()
  const out: Occurrence[] = []
  for (let i = 0; i < days; i++) {
    const ms = now + i * 24 * 3600 * 1000
    const p = mskParts(ms)
    const dateKey = mskDateKey(ms)
    const mmdd = `${String(p.mo + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
    const dateLabel = `${String(p.day).padStart(2, '0')}.${String(p.mo + 1).padStart(2, '0')} (${DOW_SHORT[p.dow]})`
    for (const def of EVENT_DEFS) {
      let occurs = false
      let names: string[] = []
      if (def.dow === null) {
        names = bdays[mmdd] ?? []
        occurs = names.length > 0
      } else {
        occurs = p.dow === def.dow
      }
      if (!occurs) continue
      const ec = cfg.events[def.id]
      const key = `${def.id}:${dateKey}`
      out.push({
        eventId: def.id,
        title: def.title,
        dateKey,
        dateLabel,
        sendHour: ec.sendHour,
        enabled: cfg.enabled && ec.enabled,
        message: renderTemplate(ec.template, {
          name: names.join(', '),
          time: def.time ?? '',
          date: `${String(p.day).padStart(2, '0')}.${String(p.mo + 1).padStart(2, '0')}`,
        }),
        hasImage: Boolean(ec.image),
        recipients: recs.length,
        sent: Boolean(cfg.sent[key]),
        sentAt: cfg.sent[key],
      })
    }
  }
  return out
}

// ── Отправка в Telegram ─────────────────────────────────────────────────────────
type SendResult = { ok: boolean; error?: string; fileId?: string; retryAfter?: number }
const TG = (method: string) => `https://api.telegram.org/bot${BOT_TOKEN}/${method}`

type TgResp = { ok?: boolean; description?: string; parameters?: { retry_after?: number } }
// Единый разбор ошибки Telegram: достаёт retry_after (429) для устойчивой рассылки.
function tgError(status: number, data: TgResp): SendResult {
  return { ok: false, error: data.description ?? `http_${status}`, retryAfter: data.parameters?.retry_after }
}

// Разбор data:URL (base64) → mime + байты. null, если не картинка.
function parseDataUrl(dataUrl?: string): { mime: string; buffer: Buffer } | null {
  if (!dataUrl) return null
  const m = /^data:(image\/[a-zA-Z.+-]+);base64,(.+)$/.exec(dataUrl)
  if (!m) return null
  try {
    return { mime: m[1], buffer: Buffer.from(m[2], 'base64') }
  } catch {
    return null
  }
}

// Текстовое сообщение (sendMessage).
async function sendText(chatId: string, text: string): Promise<SendResult> {
  if (!BOT_TOKEN) return { ok: false, error: 'no_token' }
  try {
    const r = await fetch(TG('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
    const data = (await r.json().catch(() => ({}))) as TgResp
    if (!r.ok || !data.ok) return tgError(r.status, data)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// Фото по file_id (повторная отправка уже загруженной картинки — дёшево).
async function sendPhotoById(chatId: string, fileId: string, caption: string): Promise<SendResult> {
  if (!BOT_TOKEN) return { ok: false, error: 'no_token' }
  try {
    const r = await fetch(TG('sendPhoto'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: fileId, caption, parse_mode: 'HTML' }),
    })
    const data = (await r.json().catch(() => ({}))) as TgResp
    if (!r.ok || !data.ok) return tgError(r.status, data)
    return { ok: true, fileId }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// Фото загрузкой байтов (multipart). Возвращает file_id самой большой версии —
// его переиспользуем для остальных получателей, чтобы не заливать заново.
async function sendPhotoBytes(chatId: string, buf: Buffer, mime: string, caption: string): Promise<SendResult> {
  if (!BOT_TOKEN) return { ok: false, error: 'no_token' }
  try {
    const form = new FormData()
    form.append('chat_id', chatId)
    if (caption) { form.append('caption', caption); form.append('parse_mode', 'HTML') }
    const ext = mime.split('/')[1]?.split('+')[0] || 'jpg'
    form.append('photo', new Blob([new Uint8Array(buf)], { type: mime }), `banner.${ext}`)
    const r = await fetch(TG('sendPhoto'), { method: 'POST', body: form })
    const data = (await r.json().catch(() => ({}))) as
      TgResp & { result?: { photo?: { file_id: string }[] } }
    if (!r.ok || !data.ok) return tgError(r.status, data)
    const photos = data.result?.photo ?? []
    return { ok: true, fileId: photos.length ? photos[photos.length - 1].file_id : undefined }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// Получатель «пропущен» (не ошибка): не начинал диалог с ботом / заблокировал / нет чата.
const isSkip = (err = '') =>
  /can't initiate|bot was blocked|chat not found|user is deactivated|Forbidden|403/i.test(err)

export type SendReport = {
  ok: boolean
  delivered: number
  failed: number
  skipped: number
  total: number
  error?: string
  alreadySent?: boolean
  // Резюмируемая рассылка: если partial=true, обработан не весь список —
  // повторить вызов с offset=nextOffset (клиент делает это в цикле). retryAfter —
  // сколько секунд подождать перед продолжением (после 429 от Telegram).
  partial?: boolean
  nextOffset?: number
  retryAfter?: number
}

// Собрать текст события для конкретной даты (null — событие в этот день не происходит).
function buildMessage(def: EventDef, dateKey: string, tpl: string, recs: Profile[]): string | null {
  const mmdd = dateKey.slice(5) // MM-DD
  let names: string[] = []
  if (def.dow === null) {
    names = birthdayMap(recs)[mmdd] ?? []
    if (!names.length) return null
  }
  return renderTemplate(tpl, {
    name: names.join(', '),
    time: def.time ?? '',
    date: `${dateKey.slice(8, 10)}.${dateKey.slice(5, 7)}`,
  })
}

// Бюджет времени на один проход рассылки — с запасом под лимит serverless-функции
// (maxDuration 30s). Если не успели — возвращаем partial + nextOffset, клиент
// продолжит с этого места (следующим вызовом). Так рассылка на 100+ не обрывается.
const DELIVER_BUDGET_MS = 22_000

// Разослать одно сообщение (текст + опц. картинка) получателям, начиная с offset.
// Порядок стабилен (сортировка по userId), чтобы offset был валиден между вызовами.
// Картинку заливаем один раз (первому в проходе), дальше переиспользуем file_id.
async function deliver(recs: Profile[], text: string, image?: string, startOffset = 0): Promise<SendReport> {
  const ordered = [...recs].sort((a, b) => a.userId.localeCompare(b.userId))
  const total = ordered.length
  const img = parseDataUrl(image)
  let fileId: string | null = null
  let delivered = 0, failed = 0, skipped = 0
  const start = Date.now()
  for (let i = Math.max(0, startOffset); i < ordered.length; i++) {
    if (Date.now() - start > DELIVER_BUDGET_MS) {
      return { ok: true, delivered, failed, skipped, total, partial: true, nextOffset: i }
    }
    const r = ordered[i]
    let res: SendResult
    if (img) {
      res = fileId
        ? await sendPhotoById(r.userId, fileId, text)
        : await sendPhotoBytes(r.userId, img.buffer, img.mime, text)
      if (res.ok && res.fileId) fileId = res.fileId
    } else {
      res = await sendText(r.userId, text)
    }
    if (res.ok) { delivered++; continue }
    if (res.error === 'no_token') {
      return { ok: false, delivered, failed, skipped, total, error: 'no_token' }
    }
    if (res.retryAfter != null) {
      // 429 от Telegram — не теряем получателя: пауза и продолжение с него же.
      return { ok: true, delivered, failed, skipped, total, partial: true, nextOffset: i, retryAfter: res.retryAfter }
    }
    if (isSkip(res.error)) skipped++
    else failed++
  }
  return { ok: true, delivered, failed, skipped, total }
}

// Отправить анонс события за дату dateKey всем получателям. force — повторно, игнорируя дедуп.
export async function sendEvent(
  eventId: EventId,
  dateKey: string,
  opts: { force?: boolean; offset?: number } = {},
): Promise<SendReport> {
  const def = DEF_BY_ID[eventId]
  if (!def) return { ok: false, delivered: 0, failed: 0, skipped: 0, total: 0, error: 'unknown_event' }
  const cfg = await loadConfig()
  const key = `${eventId}:${dateKey}`
  // Дедуп проверяем только в начале рассылки (offset 0); при продолжении (resume) — нет.
  if (cfg.sent[key] && !opts.force && !opts.offset) {
    return { ok: true, delivered: 0, failed: 0, skipped: 0, total: 0, alreadySent: true }
  }
  const recs = await recipients()
  const message = buildMessage(def, dateKey, cfg.events[eventId].template, recs)
  if (message === null) return { ok: false, delivered: 0, failed: 0, skipped: 0, total: 0, error: 'no_occurrence' }

  const report = await deliver(recs, message, cfg.events[eventId].image, opts.offset ?? 0)
  if (report.error) return report // no_token — не помечаем как отправленное
  if (!report.partial) { // помечаем отправленным только когда список пройден полностью
    cfg.sent[key] = Date.now()
    await saveConfig(cfg)
  }
  return report
}

// Произвольное уведомление (broadcast из админки): текст + опц. картинка всем резидентам.
export async function sendCustom(text: string, image?: string, offset = 0): Promise<SendReport> {
  const body = (text ?? '').trim()
  if (!body && !parseDataUrl(image)) {
    return { ok: false, delivered: 0, failed: 0, skipped: 0, total: 0, error: 'empty' }
  }
  const recs = await recipients()
  return deliver(recs, body, image, offset)
}

// Тестовое сообщение на конкретный chat_id (проверка бота из админки).
export async function sendTest(chatId: string, text?: string, image?: string): Promise<SendResult> {
  const caption = text?.trim() || '🔔 Тестовое уведомление из админки APClub.'
  const img = parseDataUrl(image)
  return img
    ? sendPhotoBytes(String(chatId), img.buffer, img.mime, caption)
    : sendText(String(chatId), caption)
}

// ── Авто-планировщик ────────────────────────────────────────────────────────────
// Вызывается по таймеру. Для сегодняшних событий, у которых наступил час отправки
// и которые ещё не слали, — рассылает и помечает в sent. Дедуп по ключу день+событие.
export async function runDueNotifications(): Promise<void> {
  if (!BOT_TOKEN) return // без токена авто-рассылка молча не идёт
  const cfg = await loadConfig()
  if (!cfg.enabled) return
  const now = Date.now()
  const p = mskParts(now)
  const dateKey = mskDateKey(now)
  const mmdd = `${String(p.mo + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
  const recs = await recipients()
  const bdays = birthdayMap(recs)
  for (const def of EVENT_DEFS) {
    const ec = cfg.events[def.id]
    if (!ec.enabled) continue
    const occurs = def.dow === null ? (bdays[mmdd]?.length ?? 0) > 0 : p.dow === def.dow
    if (!occurs) continue
    if (p.hour < ec.sendHour) continue // ещё рано
    if (cfg.sent[`${def.id}:${dateKey}`]) continue // уже отправляли сегодня
    const report = await sendEvent(def.id, dateKey, {})
    console.log(`[notify] ${def.id} ${dateKey}: доставлено ${report.delivered}, пропущено ${report.skipped}, ошибок ${report.failed}`)
  }
}
