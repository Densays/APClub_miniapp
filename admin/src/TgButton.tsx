import type { Profile } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Ссылка на директ-переписку в Telegram с участником.
// Приоритет: @username (надёжный https-линк) → self-указанный telegram в соцсетях
// → числовой Telegram-id (tg://user?id=… — открывает чат из Telegram Desktop/app).
// Синтетические id (m<timestamp>, заведённые вручную без Telegram) — ссылки нет.
// ─────────────────────────────────────────────────────────────────────────────
export function telegramDmLink(p: Pick<Profile, 'username' | 'userId' | 'social'>): string | null {
  const uname = (p.username ?? '').replace(/^@/, '').trim()
  if (uname) return `https://t.me/${uname}`

  const s = (p.social?.telegram ?? '').trim()
  if (s) {
    if (/^https?:\/\//i.test(s)) return s
    if (s.startsWith('@')) return `https://t.me/${s.slice(1)}`
    if (/^t\.me\//i.test(s)) return `https://${s}`
    if (/^[a-zA-Z0-9_]{3,}$/.test(s)) return `https://t.me/${s}`
  }

  if (p.userId && /^\d+$/.test(p.userId)) return `tg://user?id=${p.userId}`
  return null
}

function TgIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M21.9 4.3 18.7 19.5c-.24 1.06-.87 1.32-1.76.82l-4.86-3.58-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.94 9-8.13c.4-.35-.08-.54-.6-.2L6.4 13.1l-4.8-1.5c-1.04-.32-1.06-1.04.22-1.54l18.77-7.24c.87-.32 1.63.2 1.35 1.48z" />
    </svg>
  )
}

// Кнопка «написать в Telegram». Возвращает null, если ссылки нет.
// stopPropagation — чтобы клик не открывал карточку участника (в строках списков).
export function TgButton({ p, label = false }: { p: Pick<Profile, 'username' | 'userId' | 'social'>; label?: boolean }) {
  const href = telegramDmLink(p)
  if (!href) return null
  return (
    <a
      className={`tg-btn${label ? ' with-label' : ''}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Написать в Telegram"
      onClick={(e) => e.stopPropagation()}
    >
      <TgIcon />
      {label && <span>Написать</span>}
    </a>
  )
}
