import { useEffect, useState } from 'react'
import './Networking.css'
import Header from '../components/Header'
import { getCoffeeCandidates, coffeeSwipe, getCoffeeMatches, type ProfileData } from '../api'
import { useCatalog } from '../catalog'
import { computeStars } from '../stars'

const nameOf = (p: ProfileData) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Резидент'
const initialsOf = (p: ProfileData) => `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}` || 'AP'

// Ссылка на директ в Telegram (для «Написать»).
function contactHref(p: ProfileData): string | null {
  if (p.social?.telegram) return p.social.telegram
  if (p.username) return `https://t.me/${p.username.replace(/^@/, '')}`
  return null
}
function openTelegram(p: ProfileData) {
  const href = contactHref(p)
  if (!href) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tg = (window as any)?.Telegram?.WebApp
  if (tg?.openTelegramLink && href.includes('t.me')) tg.openTelegramLink(href)
  else window.open(href, '_blank')
}

export default function Networking({ onOpenMember }: { onOpenMember?: (id: string) => void }) {
  const catalog = useCatalog()
  const [cards, setCards] = useState<ProfileData[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [fly, setFly] = useState<'' | 'left' | 'right'>('') // анимация ухода карточки
  const [match, setMatch] = useState<ProfileData | null>(null) // оверлей мэтча
  const [view, setView] = useState<'swipe' | 'matches'>('swipe')
  const [matches, setMatches] = useState<ProfileData[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    getCoffeeCandidates().then((c) => { if (alive) setCards(c) }).catch(() => { if (alive) setError(true) })
    getCoffeeMatches().then((m) => { if (alive) setMatches(m) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const current = cards && idx < cards.length ? cards[idx] : null
  const starsOf = (p: ProfileData) => computeStars(p, catalog.achievements)
  const statusOf = (p: ProfileData) => {
    const cur = p.unlock?.current ?? 0
    return cur > 0 ? catalog.levels[cur - 1] : ''
  }

  function swipe(like: boolean) {
    if (!current || fly) return
    const target = current
    setFly(like ? 'right' : 'left')
    coffeeSwipe(target.userId ?? '', like)
      .then((res) => {
        if (res.matched && res.target) {
          setMatch(res.target)
          setMatches((m) => (m.some((x) => x.userId === res.target!.userId) ? m : [...m, res.target!]))
        }
      })
      .catch(() => {})
    // Сдвигаем к следующей карточке после короткой анимации ухода.
    window.setTimeout(() => { setIdx((i) => i + 1); setFly('') }, 260)
  }

  const StatusStars = ({ p }: { p: ProfileData }) => (
    <div className="nw-badges">
      {statusOf(p) && <span className="nw-status">{statusOf(p)}</span>}
      <span className="nw-stars">★ {starsOf(p)}</span>
    </div>
  )

  return (
    <div className="networking">
      <Header title="Нетворкинг" />

      <div className="nw-body">
        <div className="nw-tabs">
          <button className={`nw-tab${view === 'swipe' ? ' on' : ''}`} onClick={() => setView('swipe')}>Рандом-кофе</button>
          <button className={`nw-tab${view === 'matches' ? ' on' : ''}`} onClick={() => setView('matches')}>
            Мэтчи{matches.length ? ` · ${matches.length}` : ''}
          </button>
        </div>

        {view === 'swipe' && (
          <>
            <div className="nw-hint">Свайпай резидентов: ☕ — хочу на кофе, ✕ — пропустить. Взаимный лайк = мэтч.</div>

            <div className="nw-stack">
              {error && <div className="nw-empty">Не удалось загрузить. Проверь соединение.</div>}
              {!error && cards === null && <div className="nw-empty">Загрузка…</div>}
              {!error && cards && !current && (
                <div className="nw-empty">
                  На сегодня все резиденты пересмотрены ☕<br />Загляни позже — появятся новые.
                  {matches.length > 0 && (
                    <button className="nw-empty-link" onClick={() => setView('matches')}>Смотреть мэтчи ({matches.length})</button>
                  )}
                </div>
              )}

              {/* Следующая карточка «выглядывает» позади для объёма */}
              {current && cards && cards[idx + 1] && <div className="nw-card nw-card-behind" />}

              {current && (
                <div className={`nw-card${fly === 'left' ? ' fly-left' : ''}${fly === 'right' ? ' fly-right' : ''}`}>
                  <div className="nw-ava">
                    {current.avatar ? <img src={current.avatar} alt="" /> : <span>{initialsOf(current)}</span>}
                  </div>
                  <div className="nw-name">{nameOf(current)}</div>
                  <StatusStars p={current} />
                  {current.occupation && <div className="nw-occ">{current.occupation}</div>}
                  {current.about && <div className="nw-about">{current.about}</div>}
                  {current.city && <div className="nw-city">📍 {current.city}</div>}
                  <button className="nw-view-profile" onClick={() => current.userId && onOpenMember?.(current.userId)}>
                    Открыть профиль
                  </button>
                </div>
              )}
            </div>

            {current && (
              <div className="nw-actions">
                <button className="nw-btn nw-pass" onClick={() => swipe(false)} aria-label="Пропустить">✕</button>
                <button className="nw-btn nw-like" onClick={() => swipe(true)} aria-label="Хочу на кофе">☕</button>
              </div>
            )}
          </>
        )}

        {view === 'matches' && (
          <div className="nw-matches">
            {matches.length === 0 && <div className="nw-empty">Пока нет мэтчей. Лайкай резидентов — при взаимной симпатии появится связь.</div>}
            {matches.map((m) => (
              <div className="nw-match-row" key={m.userId}>
                <div className="nw-match-ava" onClick={() => m.userId && onOpenMember?.(m.userId)}>
                  {m.avatar ? <img src={m.avatar} alt="" /> : <span>{initialsOf(m)}</span>}
                </div>
                <div className="nw-match-info" onClick={() => m.userId && onOpenMember?.(m.userId)}>
                  <div className="nw-match-name">{nameOf(m)}</div>
                  <StatusStars p={m} />
                </div>
                <button className="nw-match-write" onClick={() => openTelegram(m)} disabled={!contactHref(m)}>
                  Написать
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Оверлей мэтча */}
      {match && (
        <div className="nw-overlay" onClick={() => setMatch(null)}>
          <div className="nw-overlay-card" onClick={(e) => e.stopPropagation()}>
            <div className="nw-overlay-emoji">☕✨</div>
            <div className="nw-overlay-title">Это мэтч!</div>
            <div className="nw-overlay-ava">
              {match.avatar ? <img src={match.avatar} alt="" /> : <span>{initialsOf(match)}</span>}
            </div>
            <div className="nw-overlay-name">{nameOf(match)}</div>
            <div className="nw-overlay-sub">Вы оба хотите на кофе. Напишите и договоритесь!</div>
            <button className="nw-overlay-write" onClick={() => { openTelegram(match); setMatch(null) }} disabled={!contactHref(match)}>
              Написать в Telegram
            </button>
            <button className="nw-overlay-skip" onClick={() => setMatch(null)}>Позже</button>
          </div>
        </div>
      )}
    </div>
  )
}
