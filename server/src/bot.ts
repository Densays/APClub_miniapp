// Telegram-бот клуба: приветствие по /start с кнопками «Вход в клуб» (открывает
// мини-приложение) и «Меморандум». Работает через long-polling (getUpdates) —
// не требует публичного webhook, поэтому запускается и локально, и на проде.
//
// Кнопки web_app требуют HTTPS-URL. Пока MINIAPP_URL не задан (до деплоя) —
// шлём только текст, а кнопки появятся автоматически, когда впишем URL в env.

import { WELCOME_JPEG_BASE64 } from './welcomeAsset.ts'
import { CLUBLINKS_JPEG_BASE64 } from './clubLinksAsset.ts'
import { store } from './store.ts'
import type { Profile } from './store.ts'

const BOT_TOKEN = process.env.BOT_TOKEN ?? ''
const IS_VERCEL = Boolean(process.env.VERCEL) // на Vercel — webhook вместо polling
// Админы (те же id, что и в index.ts) — получают DM о каждой регистрации на эфир.
const ADMIN_IDS = (process.env.ADMIN_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
// Баннеры — из зашитого base64 (не читаем с ФС, работает на serverless).
const WELCOME_BUF = Buffer.from(WELCOME_JPEG_BASE64, 'base64')
const CLUBLINKS_BUF = Buffer.from(CLUBLINKS_JPEG_BASE64, 'base64')
// Публичный HTTPS-адрес мини-приложения (Vercel и т.п.). Задаётся при деплое.
const MINIAPP_URL = (process.env.MINIAPP_URL ?? '').trim()
// Второе (отложенное) сообщение: ссылка на новостной канал клуба и на поддержку.
const CLUB_CHANNEL_LINK = (process.env.CLUB_CHANNEL_LINK ?? '').trim()
const SUPPORT_LINK = (process.env.SUPPORT_LINK ?? '').trim()
// Через сколько после welcome слать второе сообщение (по умолчанию 3 минуты).
const FOLLOWUP_DELAY_MS = Number(process.env.FOLLOWUP_DELAY_MS) || 3 * 60 * 1000

// Канал клуба: id (@username или -100...) для публикации закреплённого приветствия.
const CHANNEL_ID = (process.env.CHANNEL_ID ?? '').trim()
// Ссылка входа для КАНАЛА. web_app-кнопки в каналах запрещены → нужна url-кнопка
// на прямую ссылку Mini App (t.me/<bot>/<app>, настраивается в BotFather) или https.
const MINIAPP_LINK = (process.env.MINIAPP_LINK ?? '').trim()

const TG = (method: string) => `https://api.telegram.org/bot${BOT_TOKEN}/${method}`
const isHttps = (u: string) => /^https:\/\//i.test(u)

const WELCOME = [
  '<b>Добро пожаловать в APClub!</b> 🎉',
  '',
  'APClub — это сообщество криптоэнтузиастов, которые объединились, чтобы помогать друг другу развивать навыки заработка на арбитраже криптовалют.',
  '',
  '<b>Твои первые шаги:</b>',
  '<blockquote expandable>1️⃣ Зайди в приложение и заполни свой аккаунт — это важно!',
  '2️⃣ Изучи онбординг по клубу.',
  '3️⃣ Представься в чате — коротко о себе: откуда ты, какой опыт, чего хочешь достичь.</blockquote>',
  '',
  '<b>Что тебя ждёт:</b>',
  '<blockquote expandable>— Совместная практика по сделкам',
  '— Онлайн-коворкинг',
  '— Поддержка команды и обмен опытом',
  '— Инструменты, таблицы, аналитика</blockquote>',
  '',
  'Если есть вопросы — пиши в чат, здесь помогают.',
  '',
  'Большого профита тебе! 🚀',
].join('\n')

// Инлайн-клавиатура под приветствием. web_app-кнопка входа только при HTTPS.
function welcomeKeyboard(): unknown | undefined {
  if (!isHttps(MINIAPP_URL)) return undefined
  return { inline_keyboard: [[{ text: '🔓 Вход в клуб', web_app: { url: MINIAPP_URL } }]] }
}

// Ассеты-баннеры: буфер картинки + кеш file_id (заливаем один раз, дальше по id).
const WELCOME_ASSET = { buf: WELCOME_BUF, name: 'welcome.jpg', fileId: null as string | null }
const CLUBLINKS_ASSET = { buf: CLUBLINKS_BUF, name: 'apclub.jpg', fileId: null as string | null }

// Отправка баннера с подписью в любой чат/канал. Возвращает message_id (для закрепа).
// reply_markup — опц. инлайн-клавиатура. asset — какой баннер слать (по умолчанию
// приветственный). При недоступной картинке — фолбэк на текст.
async function sendBanner(
  chatId: number | string,
  caption: string,
  reply_markup?: unknown,
  asset: { buf: Buffer; name: string; fileId: string | null } = WELCOME_ASSET,
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    // 1) Повторная отправка — по file_id (дёшево).
    if (asset.fileId) {
      const r = await fetch(TG('sendPhoto'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, photo: asset.fileId, caption, parse_mode: 'HTML', reply_markup }),
      })
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { message_id?: number } }
      if (d.ok) return { ok: true, messageId: d.result?.message_id }
      asset.fileId = null // id протух / нет прав — пробуем заливкой ниже
      if (d.description && /chat not found|not enough rights|forbidden|administrator/i.test(d.description)) {
        return { ok: false, error: d.description }
      }
    }
    // 2) Первая отправка — заливаем байты, запоминаем file_id.
    const buf = asset.buf
    if (buf.length) {
      const form = new FormData()
      form.append('chat_id', String(chatId))
      form.append('caption', caption)
      form.append('parse_mode', 'HTML')
      if (reply_markup) form.append('reply_markup', JSON.stringify(reply_markup))
      form.append('photo', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), asset.name)
      const r = await fetch(TG('sendPhoto'), { method: 'POST', body: form })
      const d = (await r.json().catch(() => ({}))) as
        { ok?: boolean; description?: string; result?: { message_id?: number; photo?: { file_id: string }[] } }
      if (d.ok) {
        const photos = d.result?.photo ?? []
        if (photos.length) asset.fileId = photos[photos.length - 1].file_id
        return { ok: true, messageId: d.result?.message_id }
      }
      if (d.description) return { ok: false, error: d.description }
    }
    // 3) Фолбэк — текстом.
    const r = await fetch(TG('sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup }),
    })
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { message_id?: number } }
    return d.ok ? { ok: true, messageId: d.result?.message_id } : { ok: false, error: d.description }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// Приветствие в личку по /start.
async function sendWelcome(chatId: number): Promise<void> {
  const reply_markup = welcomeKeyboard()
  const caption = reply_markup
    ? WELCOME
    : WELCOME + '\n\n<i>🔗 Кнопка входа появится после публикации приложения.</i>'
  const res = await sendBanner(chatId, caption, reply_markup)
  if (!res.ok) console.error('[bot] sendWelcome error:', res.error)
}

// ── Второе (отложенное) сообщение: новостной канал + поддержка ────────────────
const FOLLOWUP_TEXT =
  'Для твоего удобства подписывайся на новостной канал, где мы публикуем ключевые события клуба. Если возникнут вопросы, пиши в поддержку.'

// Кнопки: «Канал клуба» + «Написать в поддержку» (только те, чья ссылка задана).
function followupKeyboard(): unknown | undefined {
  const rows: { text: string; url: string }[][] = []
  if (CLUB_CHANNEL_LINK) rows.push([{ text: '📣 Канал клуба', url: CLUB_CHANNEL_LINK }])
  if (SUPPORT_LINK) rows.push([{ text: '💬 Написать в поддержку', url: SUPPORT_LINK }])
  return rows.length ? { inline_keyboard: rows } : undefined
}

async function sendClubLinks(chatId: number | string): Promise<boolean> {
  const res = await sendBanner(chatId, FOLLOWUP_TEXT, followupKeyboard(), CLUBLINKS_ASSET)
  if (!res.ok) console.error('[bot] sendClubLinks error:', res.error)
  return res.ok
}

// Планируем второе сообщение через ~3 мин — ОДИН раз на пользователя (на его же
// строке, без общей записи). Если уже отправлено или запланировано — пропускаем.
async function scheduleFollowup(chatId: number): Promise<void> {
  try {
    const p = await store.get(String(chatId))
    if (p?.followupSent || typeof p?.followupDueAt === 'number') return
    await store.upsert(String(chatId), { followupDueAt: Date.now() + FOLLOWUP_DELAY_MS })
  } catch (e) { console.error('[bot] scheduleFollowup:', (e as Error).message) }
}

// Рассылка «дозревших» отложенных сообщений. serverless не держит setTimeout,
// поэтому дёргаем это из вебхука (на каждый апдейт), из cron и из локального
// планировщика. Помечаем followupSent, чтобы не слать повторно.
let flushing = false
export async function flushFollowups(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    const due = await store.dueFollowups(Date.now())
    for (const id of due) {
      const p = await store.get(id)
      if (!p || p.followupSent || typeof p.followupDueAt !== 'number') continue
      await sendClubLinks(id)
      await store.upsert(id, { followupSent: true, followupDueAt: null })
    }
  } catch (e) {
    console.error('[bot] flushFollowups error:', (e as Error).message)
  } finally {
    flushing = false
  }
}

// ── Нетворкинг: уведомление о запросе на знакомство + подтверждение ──────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
const displayName = (p?: Profile | null) =>
  `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || 'Резидент клуба'

async function tgSend(method: string, payload: Record<string, unknown>): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await fetch(TG(method), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
  } catch (e) { console.error(`[bot] ${method} error:`, (e as Error).message) }
}

// DM получателю: «[Имя] предложил познакомиться» + кнопка «Подтвердить».
export async function sendNetworkingRequest(toId: string, fromName: string, fromId: string): Promise<void> {
  const text =
    `👋 <b>${escapeHtml(fromName)}</b> предложил вам познакомиться.\n\n` +
    'Если вам интересно — откройте приложение, ответьте взаимностью и нажмите кнопку «Подтвердить» под сообщением.'
  const rows: Record<string, unknown>[][] = [[{ text: '✅ Подтвердить', callback_data: `nwok:${fromId}` }]]
  if (isHttps(MINIAPP_URL)) rows.push([{ text: '📲 Открыть приложение', web_app: { url: MINIAPP_URL } }])
  await tgSend('sendMessage', { chat_id: toId, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } })
}

// ── Регистрация на «Эфир в клубе» ─────────────────────────────────────────────
// DM всем админам (ADMIN_IDS) сразу при регистрации — чтобы видеть список
// пришедших в реальном времени (полный список — в веб-админке).
export async function sendEfirRegistrationAlert(name: string, username: string | undefined, dateKey: string, time: string): Promise<void> {
  if (!ADMIN_IDS.length) return
  const who = username ? `@${escapeHtml(username)}` : 'без ника'
  const [y, m, d] = dateKey.split('-')
  const text =
    `📋 <b>Регистрация на Эфир в клубе</b>\n${escapeHtml(name)} (${who})\n${d}.${m}.${y}, ${time} МСК`
  await Promise.all(ADMIN_IDS.map((id) => tgSend('sendMessage', { chat_id: id, text, parse_mode: 'HTML' })))
}

// Подтверждение знакомства (из бота-кнопки ИЛИ из приложения): meId отвечает
// взаимностью на запрос fromId. Это НЕ новый исходящий запрос — недельный лимит
// не тратится (без coffeeLikeAt). При взаимности — мэтч + уведомление обоим.
export async function confirmNetworking(meId: string, fromId: string): Promise<{ ok: boolean; matched: boolean }> {
  if (!meId || !fromId || meId === fromId) return { ok: false, matched: false }
  const me = (await store.get(meId)) ?? ({ userId: meId } as Profile)
  const from = await store.get(fromId)
  if (!from) return { ok: false, matched: false }
  const likes = new Set(me.coffeeLikes ?? [])
  likes.add(fromId)
  await store.upsert(meId, { coffeeLikes: [...likes] })
  const matched = (from.coffeeLikes ?? []).includes(meId)
  if (matched) {
    await tgSend('sendMessage', { chat_id: fromId, parse_mode: 'HTML', text: `🎉 <b>Это мэтч!</b> ${escapeHtml(displayName(me))} ответил(а) взаимностью. Откройте приложение → «Мэтчи», чтобы списаться.` })
    await tgSend('sendMessage', { chat_id: meId, parse_mode: 'HTML', text: `🎉 <b>Это мэтч!</b> с ${escapeHtml(displayName(from))}. Откройте приложение → «Мэтчи».` })
  }
  return { ok: true, matched }
}

async function answerCallback(id: string, text: string): Promise<void> {
  await tgSend('answerCallbackQuery', { callback_query_id: id, text })
}

type CallbackQuery = { id: string; from?: { id: number }; data?: string }
async function handleCallback(cq: CallbackQuery): Promise<void> {
  const data = cq.data ?? ''
  const meId = String(cq.from?.id ?? '')
  if (data.startsWith('nwok:') && meId) {
    const res = await confirmNetworking(meId, data.slice(5))
    await answerCallback(cq.id, res.matched ? '🎉 Взаимно! Это мэтч' : '✓ Подтверждено')
  } else {
    await answerCallback(cq.id, '')
  }
}

type Update = {
  update_id: number
  message?: { chat?: { id: number }; text?: string }
  callback_query?: CallbackQuery
}

// Обработка одного апдейта (общая для polling и webhook).
export async function handleUpdate(u: Update): Promise<void> {
  // Любой апдейт — повод разослать «дозревшие» отложенные вторые сообщения
  // (на serverless нет фонового таймера; вебхук — самый частый триггер).
  await flushFollowups()
  if (u.callback_query) { await handleCallback(u.callback_query); return }
  const chatId = u.message?.chat?.id
  if (!chatId) return
  // На /start и на любое сообщение показываем приветствие с входом.
  await sendWelcome(chatId)
  // И один раз ставим отложенное второе сообщение (канал + поддержка).
  await scheduleFollowup(chatId)
}

// Установить/снять webhook (для serverless-режима). url — полный адрес эндпоинта.
export async function setWebhook(url: string): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN) return { ok: false, error: 'no_token' }
  try {
    const r = await fetch(TG('setWebhook'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true }),
    })
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string }
    return { ok: Boolean(d.ok), error: d.ok ? undefined : d.description }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

let running = false

// Цикл long-polling. Держит offset, чтобы не обрабатывать апдейты повторно.
async function pollLoop(): Promise<void> {
  let offset = 0
  while (running) {
    try {
      const r = await fetch(TG('getUpdates') + `?timeout=30&offset=${offset}&allowed_updates=["message","callback_query"]`)
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: Update[]; description?: string }
      if (!data.ok) {
        // 409 Conflict — если параллельно запущен другой поллер/вебхук. Ждём и пробуем снова.
        if (data.description) console.warn('[bot] getUpdates:', data.description)
        await sleep(3000)
        continue
      }
      for (const u of data.result ?? []) {
        offset = u.update_id + 1
        await handleUpdate(u)
      }
    } catch (e) {
      console.error('[bot] poll error:', (e as Error).message)
      await sleep(3000)
    }
  }
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

// ── Приветствие в КАНАЛ (закреплённый пост с кнопкой входа) ───────────────────
// url-кнопка (web_app в каналах нельзя). Показываем только если задана ссылка.
function channelKeyboard(): unknown | undefined {
  if (!MINIAPP_LINK) return undefined
  return { inline_keyboard: [[{ text: '🔓 Войти', url: MINIAPP_LINK }]] }
}

// Достаёт @username пользователя через getChat. Работает, если бот уже
// переписывался с пользователем (тот нажимал /start). Нужен для НАДЁЖНОЙ ссылки
// на директ в админке: tg://user?id=… часто открывает «Избранное», а
// https://t.me/<username> ведёт прямо в чат.
export async function fetchUsername(userId: string): Promise<string | null> {
  if (!BOT_TOKEN) return null
  try {
    const r = await fetch(TG('getChat') + `?chat_id=${encodeURIComponent(userId)}`)
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: { username?: string } }
    if (d.ok && d.result?.username) return String(d.result.username)
  } catch { /* сеть/недоступен */ }
  return null
}

// id самого бота (для проверки его прав в канале) — кешируем через getMe.
let botIdCache: number | null = null
async function getBotId(): Promise<number | null> {
  if (botIdCache) return botIdCache
  try {
    const r = await fetch(TG('getMe'))
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; result?: { id: number } }
    if (d.ok && d.result) botIdCache = d.result.id
  } catch { /* игнор */ }
  return botIdCache
}

export type ChannelStatus = {
  configured: boolean // задан ли CHANNEL_ID
  hasLink: boolean // задана ли ссылка входа (MINIAPP_LINK)
  link?: string // сама ссылка (не секрет — подставляется по умолчанию в кнопку анонса)
  channelId: string
  isAdmin: boolean
  canPost: boolean
  canPin: boolean
  title?: string
  error?: string
}

// Проверка: бот — админ канала с правами постить и закреплять.
export async function channelStatus(): Promise<ChannelStatus> {
  const base: ChannelStatus = {
    configured: Boolean(CHANNEL_ID), hasLink: Boolean(MINIAPP_LINK), link: MINIAPP_LINK || undefined, channelId: CHANNEL_ID,
    isAdmin: false, canPost: false, canPin: false,
  }
  if (!BOT_TOKEN || !CHANNEL_ID) return base
  const botId = await getBotId()
  if (!botId) return { ...base, error: 'no_bot_id' }
  try {
    // Заодно получим название канала.
    const chatR = await fetch(TG('getChat') + `?chat_id=${encodeURIComponent(CHANNEL_ID)}`)
    const chatD = (await chatR.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { title?: string } }
    if (!chatD.ok) return { ...base, error: chatD.description ?? 'chat_not_found' }
    const memR = await fetch(TG('getChatMember') + `?chat_id=${encodeURIComponent(CHANNEL_ID)}&user_id=${botId}`)
    const memD = (await memR.json().catch(() => ({}))) as
      { ok?: boolean; description?: string; result?: { status?: string; can_post_messages?: boolean; can_pin_messages?: boolean } }
    if (!memD.ok) return { ...base, title: chatD.result?.title, error: memD.description ?? 'member_check_failed' }
    const st = memD.result
    const isCreator = st?.status === 'creator'
    const isAdmin = st?.status === 'administrator' || isCreator
    // Строгая проверка: Telegram ОПУСКАЕТ право, если оно не выдано (undefined),
    // поэтому сверяем именно с true. Создатель канала имеет все права по умолчанию.
    return {
      ...base,
      title: chatD.result?.title,
      isAdmin,
      canPost: isCreator || st?.can_post_messages === true,
      canPin: isCreator || st?.can_pin_messages === true,
    }
  } catch (e) {
    return { ...base, error: (e as Error).message }
  }
}

// Опубликовать приветствие в канал (баннер + текст + url-кнопка) и закрепить.
export async function publishChannelEntry(): Promise<{ ok: boolean; posted: boolean; pinned: boolean; error?: string }> {
  if (!BOT_TOKEN) return { ok: false, posted: false, pinned: false, error: 'no_token' }
  if (!CHANNEL_ID) return { ok: false, posted: false, pinned: false, error: 'no_channel' }
  const kb = channelKeyboard()
  const caption = kb ? WELCOME : WELCOME + '\n\n<i>🔗 Кнопка входа появится после настройки ссылки Mini App.</i>'
  const sent = await sendBanner(CHANNEL_ID, caption, kb)
  if (!sent.ok || !sent.messageId) return { ok: false, posted: false, pinned: false, error: sent.error ?? 'send_failed' }
  // Закрепляем пост (без звукового уведомления всем).
  try {
    const r = await fetch(TG('pinChatMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHANNEL_ID, message_id: sent.messageId, disable_notification: true }),
    })
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string }
    return { ok: true, posted: true, pinned: Boolean(d.ok), error: d.ok ? undefined : d.description }
  } catch (e) {
    return { ok: true, posted: true, pinned: false, error: (e as Error).message }
  }
}

// Telegram принимает у inline-кнопок только http(s):// или tg:// (иначе 400).
function isValidButtonUrl(url: string): boolean {
  return /^(https?:\/\/|tg:\/\/)\S+$/i.test(url.trim())
}

// Кастомная кнопка (текст+ссылка), если обе заданы и ссылка валидна — иначе undefined.
function customButtonMarkup(buttonText?: string, buttonUrl?: string): unknown | undefined {
  const text = (buttonText ?? '').trim()
  const url = (buttonUrl ?? '').trim()
  if (!text || !isValidButtonUrl(url)) return undefined
  return { inline_keyboard: [[{ text, url }]] }
}

// Отправка текста/фото с опц. клавиатурой в произвольный чат/канал. Картинка —
// одноразовая (не кешируем file_id, в отличие от sendBanner): у каждого анонса своя.
async function sendCaptioned(
  chatId: string | number, caption: string, image?: string, reply_markup?: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN) return { ok: false, error: 'no_token' }
  const img = /^data:(image\/[a-zA-Z.+-]+);base64,(.+)$/.exec(image ?? '')
  try {
    if (img) {
      const buf = Buffer.from(img[2], 'base64')
      const ext = img[1].split('/')[1]?.split('+')[0] || 'jpg'
      const form = new FormData()
      form.append('chat_id', String(chatId))
      if (caption) { form.append('caption', caption); form.append('parse_mode', 'HTML') }
      if (reply_markup) form.append('reply_markup', JSON.stringify(reply_markup))
      form.append('photo', new Blob([new Uint8Array(buf)], { type: img[1] }), `banner.${ext}`)
      const r = await fetch(TG('sendPhoto'), { method: 'POST', body: form })
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string }
      return d.ok ? { ok: true } : { ok: false, error: d.description }
    }
    const r = await fetch(TG('sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: caption, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup }),
    })
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string }
    return d.ok ? { ok: true } : { ok: false, error: d.description }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// Опубликовать ПРОИЗВОЛЬНЫЙ анонс в канал (текст + опц. картинка). Кнопка —
// свой текст+ссылка, если заданы и ссылка валидна; иначе дефолт «Войти» →
// мини-приложение (та же, что у закреплённого приветствия). Не закрепляет —
// обычный пост в ленту канала.
export async function publishChannelCustom(
  caption: string, image?: string, buttonText?: string, buttonUrl?: string,
): Promise<{ ok: boolean; posted: boolean; error?: string }> {
  if (!CHANNEL_ID) return { ok: false, posted: false, error: 'no_channel' }
  const reply_markup = customButtonMarkup(buttonText, buttonUrl) ?? channelKeyboard()
  const r = await sendCaptioned(CHANNEL_ID, caption, image, reply_markup)
  return { ok: r.ok, posted: r.ok, error: r.error }
}

// Тестовое сообщение себе (проверка из админки) с опц. кастомной кнопкой —
// чтобы можно было проверить анонс «В канал» (текст+кнопка) до публикации.
export async function sendTestWithButton(
  chatId: string, text: string, image?: string, buttonText?: string, buttonUrl?: string,
): Promise<{ ok: boolean; error?: string }> {
  const reply_markup = customButtonMarkup(buttonText, buttonUrl)
  return sendCaptioned(chatId, text, image, reply_markup)
}

// Запуск бота (вызывается из index.ts). Без BOT_TOKEN — no-op.
export function startBot(): void {
  if (!BOT_TOKEN) {
    console.warn('⚠️  BOT_TOKEN не задан — бот не запущен.')
    return
  }
  if (running) return
  const mode = welcomeKeyboard() ? `фото + кнопка входа (${MINIAPP_URL})` : 'фото без кнопки входа (MINIAPP_URL не задан)'
  // На Vercel (serverless) polling невозможен — там работает webhook.
  if (IS_VERCEL) {
    console.log(`🤖 Бот: webhook-режим (Vercel). Приветствие — ${mode}`)
    return
  }
  running = true
  console.log(`🤖 Бот запущен (long-polling), приветствие — ${mode}`)
  pollLoop()
}
