// Telegram-бот клуба: приветствие по /start с кнопками «Вход в клуб» (открывает
// мини-приложение) и «Меморандум». Работает через long-polling (getUpdates) —
// не требует публичного webhook, поэтому запускается и локально, и на проде.
//
// Кнопки web_app требуют HTTPS-URL. Пока MINIAPP_URL не задан (до деплоя) —
// шлём только текст, а кнопки появятся автоматически, когда впишем URL в env.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BOT_TOKEN = process.env.BOT_TOKEN ?? ''
// Баннер приветствия (лежит в server/assets, рядом с бандлом).
const WELCOME_IMG = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'welcome.jpg')
// Публичный HTTPS-адрес мини-приложения (Vercel и т.п.). Задаётся при деплое.
const MINIAPP_URL = (process.env.MINIAPP_URL ?? '').trim()

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
  'Рады, что ты с нами. Здесь собрались практики, которые зарабатывают на арбитраже криптоактивов по дельта-нейтральным стратегиям.',
  '',
  '<b>Твои первые шаги:</b>',
  '1️⃣ Зайди в приложение и заполни свой аккаунт — это важно!',
  '2️⃣ Изучи онбординг по клубу.',
  '3️⃣ Представься в чате — коротко о себе: откуда ты, какой опыт, чего хочешь достичь.',
  '',
  '<b>Что тебя ждёт:</b>',
  '— Совместная практика по сделкам',
  '— Онлайн-коворкинг',
  '— Поддержка команды и обмен опытом',
  '— Инструменты, таблицы, аналитика',
  '',
  'Если есть вопросы — пиши в чат, здесь помогают.',
  '',
  'Большого профита тебе! 🚀',
].join('\n')

// Инлайн-клавиатура под приветствием. web_app-кнопка входа только при HTTPS.
function welcomeKeyboard(): unknown | undefined {
  if (!isHttps(MINIAPP_URL)) return undefined
  return { inline_keyboard: [[{ text: '🚀 Вход в клуб', web_app: { url: MINIAPP_URL } }]] }
}

// Кеш file_id баннера: заливаем один раз, дальше шлём по id (не перезагружаем).
let welcomeFileId: string | null = null

// Отправка баннера с подписью в любой чат/канал. Возвращает message_id (для закрепа).
// reply_markup — опц. инлайн-клавиатура. При недоступной картинке — фолбэк на текст.
async function sendBanner(
  chatId: number | string,
  caption: string,
  reply_markup?: unknown,
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    // 1) Повторная отправка — по file_id (дёшево).
    if (welcomeFileId) {
      const r = await fetch(TG('sendPhoto'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, photo: welcomeFileId, caption, parse_mode: 'HTML', reply_markup }),
      })
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { message_id?: number } }
      if (d.ok) return { ok: true, messageId: d.result?.message_id }
      welcomeFileId = null // id протух / нет прав — пробуем заливкой ниже
      if (d.description && /chat not found|not enough rights|forbidden|administrator/i.test(d.description)) {
        return { ok: false, error: d.description }
      }
    }
    // 2) Первая отправка — заливаем байты, запоминаем file_id.
    const buf = await readFile(WELCOME_IMG).catch(() => null)
    if (buf) {
      const form = new FormData()
      form.append('chat_id', String(chatId))
      form.append('caption', caption)
      form.append('parse_mode', 'HTML')
      if (reply_markup) form.append('reply_markup', JSON.stringify(reply_markup))
      form.append('photo', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), 'welcome.jpg')
      const r = await fetch(TG('sendPhoto'), { method: 'POST', body: form })
      const d = (await r.json().catch(() => ({}))) as
        { ok?: boolean; description?: string; result?: { message_id?: number; photo?: { file_id: string }[] } }
      if (d.ok) {
        const photos = d.result?.photo ?? []
        if (photos.length) welcomeFileId = photos[photos.length - 1].file_id
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

type Update = { update_id: number; message?: { chat?: { id: number }; text?: string } }

async function handleUpdate(u: Update): Promise<void> {
  const chatId = u.message?.chat?.id
  if (!chatId) return
  // На /start и на любое сообщение показываем приветствие с входом.
  await sendWelcome(chatId)
}

let running = false

// Цикл long-polling. Держит offset, чтобы не обрабатывать апдейты повторно.
async function pollLoop(): Promise<void> {
  let offset = 0
  while (running) {
    try {
      const r = await fetch(TG('getUpdates') + `?timeout=30&offset=${offset}&allowed_updates=["message"]`)
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
  return { inline_keyboard: [[{ text: '🚀 Вход в клуб', url: MINIAPP_LINK }]] }
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
    configured: Boolean(CHANNEL_ID), hasLink: Boolean(MINIAPP_LINK), channelId: CHANNEL_ID,
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
    const isAdmin = st?.status === 'administrator' || st?.status === 'creator'
    return {
      ...base,
      title: chatD.result?.title,
      isAdmin,
      canPost: isAdmin && st?.can_post_messages !== false,
      canPin: isAdmin && st?.can_pin_messages !== false,
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

// Запуск бота (вызывается из index.ts). Без BOT_TOKEN — no-op.
export function startBot(): void {
  if (!BOT_TOKEN) {
    console.warn('⚠️  BOT_TOKEN не задан — бот не запущен.')
    return
  }
  if (running) return
  running = true
  const mode = welcomeKeyboard() ? `фото + кнопка входа (${MINIAPP_URL})` : 'фото без кнопки входа (MINIAPP_URL не задан)'
  console.log(`🤖 Бот запущен (long-polling), приветствие — ${mode}`)
  pollLoop()
}
