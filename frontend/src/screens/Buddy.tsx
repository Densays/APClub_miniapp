import { useEffect, useRef, useState } from 'react'
import './Buddy.css'
import Header from '../components/Header'
import Stars from '../components/Stars'
import { starItems } from '../stars'
import { findBuddy, getProfiles } from '../api'
import type { ProfileData } from '../api'
import { useAchievements } from '../catalog'

const STEPS = [
  { t: 'Найдите напарника', s: 'Используйте автоподбор' },
  { t: 'Договоритесь о формате', s: 'Частота созвонов, темы для обсуждения' },
  { t: 'Поддерживайте друг друга', s: 'Делитесь успехами и сложностями минимум 1 раз в неделю' },
  { t: 'Перед эфиром — поштурмите с бадди', s: 'Прежде чем выходить на разборы, обсудите решение' },
]

const VIDEO_URL = 'https://www.youtube.com/watch?v=B0Gx6AZUCWY' // обязательное видео (Майкл Роуч. 4 шага)

function nameOf(p: ProfileData) {
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Участник'
}
function initialsOf(p: ProfileData) {
  return `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}` || 'AP'
}
function contactHref(b: ProfileData): string | null {
  if (b.social?.telegram) return b.social.telegram
  if (b.username) return `https://t.me/${b.username}`
  return null
}

function BuddyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </svg>
  )
}

export default function Buddy({ onBack, onOpenMember }: { onBack?: () => void; onOpenMember?: (id: string) => void }) {
  const CATALOG = useAchievements()
  const [phase, setPhase] = useState<'intro' | 'searching' | 'result'>('intro')
  const [buddy, setBuddy] = useState<ProfileData | null>(null)
  const [pool, setPool] = useState<ProfileData[]>([])
  const [tick, setTick] = useState(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    let alive = true
    // Ничего не запускаем автоматически: страница всегда открывается с кнопкой «НАЙТИ».
    // Пул участников грузим заранее — только для анимации перебора.
    getProfiles().then((list) => { if (alive) setPool(list) }).catch(() => {})
    return () => {
      alive = false
      timers.current.forEach(clearInterval)
      timers.current.forEach(clearTimeout)
    }
  }, [])

  function handleFind() {
    setPhase('searching')
    // Плавный перебор кандидатов (мягкий фейд на каждом шаге)
    const spin = window.setInterval(() => setTick((t) => t + 1), 200)
    timers.current.push(spin)
    // Фиксируем результат с сервера
    const done = window.setTimeout(async () => {
      clearInterval(spin)
      try {
        const r = await findBuddy()
        setBuddy(r.buddy)
      } catch {
        setBuddy(null)
      }
      setPhase('result')
    }, 2600)
    timers.current.push(done)
  }

  function openContact() {
    if (!buddy) return
    const href = contactHref(buddy)
    if (!href) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tg = (window as any)?.Telegram?.WebApp
    if (tg?.openTelegramLink && href.includes('t.me')) tg.openTelegramLink(href)
    else window.open(href, '_blank')
  }

  const spinItem = pool.length ? pool[tick % pool.length] : null
  const orbit = pool.slice(0, 8)
  const earned = starItems(buddy, CATALOG)

  return (
    <div className="buddy">
      <Header title="БАДДИ" onBack={onBack} />
      <div className="bd-body">
        <button className="bd-back" onClick={onBack}>‹ Назад</button>

        <h1 className="bd-title">БАДДИ</h1>
        <p className="bd-subtitle">Напарник для совместной работы и развития внутри комьюнити</p>

        <div className="bd-about card">
          <div className="bd-about-icon"><BuddyIcon /></div>
          <div className="bd-about-text">
            <div className="bd-about-title">Напарник</div>
            <div className="bd-about-sub">Поддержка на пути к целям</div>
            <p className="bd-about-desc">
              Бадди — это ваш партнёр по росту. Вы помогаете друг другу достигать целей,
              обмениваетесь опытом и поддерживаете в трудные моменты. Это взаимовыгодное
              партнёрство, основанное на доверии.
            </p>
          </div>
        </div>

        {/* Зона действия: кнопка → анимация подбора → результат (в пределах страницы) */}
        <div className="bd-action">
          {phase === 'intro' && (
            <button className="bd-find" onClick={handleFind}>НАЙТИ</button>
          )}

          {phase === 'searching' && (
            <div className="bd-search">
              <div className="bd-orbit">
                <div className="bd-orbit-ring">
                  {orbit.map((p, i) => (
                    <div
                      className="bd-orbit-item"
                      key={i}
                      style={{ ['--i' as string]: i, ['--n' as string]: orbit.length }}
                    >
                      <div className="bd-orbit-ava">
                        {p.avatar ? <img src={p.avatar} alt="" /> : <span>{initialsOf(p)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bd-orbit-center" key={tick}>
                  {spinItem?.avatar ? <img src={spinItem.avatar} alt="" /> : <span>{spinItem ? initialsOf(spinItem) : '👤'}</span>}
                </div>
              </div>
              <div className="bd-spin-title">Ищем совпадение…</div>
              <div className="bd-spin-name" key={`n${tick}`}>{spinItem ? nameOf(spinItem) : ' '}</div>
            </div>
          )}

          {phase === 'result' && (
            buddy ? (
              <div className="bd-result card">
                <div className="bd-result-badge">✨ Есть совпадение — твой бадди на месяц</div>
                <div className="bd-result-ava">
                  {buddy.avatar ? <img src={buddy.avatar} alt="" /> : <span>{initialsOf(buddy)}</span>}
                </div>
                <div className="bd-result-name">{nameOf(buddy)}</div>
                {buddy.occupation && <div className="bd-result-occ">{buddy.occupation}</div>}
                {buddy.about && <div className="bd-result-about">{buddy.about}</div>}
                <div className="bd-result-stars"><Stars filled={earned.length} total={CATALOG.length} size={14} /></div>
                <div className="bd-result-actions">
                  <button className="bd-write" onClick={openContact} disabled={!contactHref(buddy)}>✍️ Написать</button>
                  <button className="bd-open" onClick={() => buddy.userId && onOpenMember?.(buddy.userId)}>Профиль</button>
                </div>
                <div className="bd-note">Выбор бадди — один раз в месяц. Следующий подбор откроется в следующем месяце.</div>
              </div>
            ) : (
              <div className="bd-empty">Пока некого предложить — в клубе слишком мало участников с профилем. Загляни позже.</div>
            )
          )}
        </div>

        <div className="bd-how-title">💡 Как работать с бадди</div>
        <div className="bd-steps">
          {STEPS.map((s, i) => (
            <div className="bd-step" key={i}>
              <div className="bd-step-num">{i + 1}</div>
              <div className="bd-step-text">
                <div className="bd-step-t">{s.t}</div>
                <div className="bd-step-s">{s.s}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bd-video card">
          <div className="bd-video-play">▶</div>
          <div className="bd-video-text">
            <div className="bd-video-t">Майкл Роуч. 4 шага.</div>
            <div className="bd-video-s">Как достигать целей?</div>
          </div>
          <button className="bd-video-btn" onClick={() => VIDEO_URL && window.open(VIDEO_URL, '_blank')}>ПЕРЕЙТИ ›</button>
        </div>
        <div className="bd-video-note">Обязательное видео для понимания принципа работы с напарником</div>
      </div>
    </div>
  )
}
