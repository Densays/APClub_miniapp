import { useEffect, useRef, useState } from 'react'
import './Networking.css'
import Header from '../components/Header'
import {
  getCoffeeCandidates, coffeeSwipe, getCoffeeMatches, getCoffeePending, coffeePin,
  type ProfileData,
} from '../api'
import { useCatalog } from '../catalog'
import { computeStars } from '../stars'

type Pending = ProfileData & { pinned?: boolean }

const nameOf = (p: ProfileData) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Резидент'
const initialsOf = (p: ProfileData) => `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}` || 'AP'

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

const SWIPE_THRESHOLD = 110

export default function Networking({ onOpenMember }: { onOpenMember?: (id: string) => void }) {
  const catalog = useCatalog()
  const [view, setView] = useState<'swipe' | 'pending' | 'matches'>('swipe')
  const [cards, setCards] = useState<ProfileData[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [leaving, setLeaving] = useState<'' | 'left' | 'right'>('')
  const [drag, setDrag] = useState(0)
  const [match, setMatch] = useState<ProfileData | null>(null)
  const [matches, setMatches] = useState<ProfileData[]>([])
  const [pending, setPending] = useState<Pending[] | null>(null)
  const [maxPins, setMaxPins] = useState(3)
  const [pinMsg, setPinMsg] = useState('')
  const [error, setError] = useState(false)
  const dragStart = useRef<number | null>(null)
  const dragX = useRef(0)

  useEffect(() => {
    let alive = true
    getCoffeeCandidates().then((c) => { if (alive) setCards(c) }).catch(() => { if (alive) setError(true) })
    getCoffeeMatches().then((m) => { if (alive) setMatches(m) }).catch(() => {})
    return () => { alive = false }
  }, [])

  // Подгружаем «Избранные» при первом открытии вкладки.
  useEffect(() => {
    if (view === 'pending' && pending === null) {
      getCoffeePending().then((r) => { setPending(r.pending); setMaxPins(r.maxPins) }).catch(() => setPending([]))
    }
  }, [view, pending])

  const catAch = catalog.achievements
  const starsOf = (p: ProfileData) => computeStars(p, catAch)
  const statusOf = (p: ProfileData) => {
    const cur = p.unlock?.current ?? 0
    return cur > 0 ? catalog.levels[cur - 1] : ''
  }
  const current = cards && idx < cards.length ? cards[idx] : null

  function swipe(like: boolean) {
    if (!current || leaving) return
    const target = current
    setLeaving(like ? 'right' : 'left')
    coffeeSwipe(target.userId ?? '', like)
      .then((res) => {
        if (res.matched && res.target) {
          setMatch(res.target)
          setMatches((m) => (m.some((x) => x.userId === res.target!.userId) ? m : [...m, res.target!]))
        }
        // лайкнутый (без мэтча) появится в «Избранных» — сбросим кэш вкладки
        if (like) setPending(null)
      })
      .catch(() => {})
    window.setTimeout(() => { setIdx((i) => i + 1); setLeaving(''); setDrag(0); dragX.current = 0 }, 300)
  }

  // ── Драг-свайп верхней карточки ──
  function onDown(e: React.PointerEvent) {
    if (leaving || !current) return
    dragStart.current = e.clientX
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  function onMove(e: React.PointerEvent) {
    if (dragStart.current == null) return
    dragX.current = e.clientX - dragStart.current
    setDrag(dragX.current)
  }
  function onUp() {
    if (dragStart.current == null) return
    dragStart.current = null
    const dx = dragX.current
    if (Math.abs(dx) > SWIPE_THRESHOLD) swipe(dx > 0)
    else { setDrag(0); dragX.current = 0 }
  }

  async function togglePin(p: Pending) {
    setPinMsg('')
    const next = !p.pinned
    const res = await coffeePin(p.userId ?? '', next)
    if (!res.ok) { setPinMsg(res.error === 'pin_limit' ? `Можно закрепить только ${maxPins}` : 'Не удалось'); return }
    // Перечитываем список (сервер пересортирует закреплённые наверх).
    const r = await getCoffeePending().catch(() => null)
    if (r) { setPending(r.pending); setMaxPins(r.maxPins) }
  }

  // Стиль верхней карточки: драг-смещение или анимация ухода.
  const topStyle: React.CSSProperties = leaving
    ? {}
    : { transform: `translateX(${drag}px) rotate(${drag * 0.05}deg)`, transition: dragStart.current == null ? 'transform .25s' : 'none' }

  const Badges = ({ p }: { p: ProfileData }) => (
    <div className="nw-badges">
      {statusOf(p) && <span className="nw-status">{statusOf(p)}</span>}
      <span className="nw-stars">★ {starsOf(p)}</span>
    </div>
  )

  const socialLinks = (p: ProfileData) => {
    const s = p.social ?? {}
    return [
      { k: 'telegram', label: 'Telegram', v: s.telegram },
      { k: 'instagram', label: 'Instagram', v: s.instagram },
      { k: 'linkedin', label: 'LinkedIn', v: s.linkedin },
      { k: 'web', label: 'Сайт', v: s.web },
    ].filter((x) => x.v)
  }

  // ── Детальная карточка (свайп) ──
  const Card = ({ p, top }: { p: ProfileData; top?: boolean }) => (
    <div
      className={`nw-card${top && leaving === 'left' ? ' leave-left' : ''}${top && leaving === 'right' ? ' leave-right' : ''}`}
      style={top ? topStyle : undefined}
      onPointerDown={top ? onDown : undefined}
      onPointerMove={top ? onMove : undefined}
      onPointerUp={top ? onUp : undefined}
      onPointerCancel={top ? onUp : undefined}
    >
      {top && drag > 40 && <div className="nw-hint-like">☕ НА КОФЕ</div>}
      {top && drag < -40 && <div className="nw-hint-nope">✕ МИМО</div>}
      <div className="nw-ava">
        {p.avatar ? <img src={p.avatar} alt="" draggable={false} /> : <span>{initialsOf(p)}</span>}
      </div>
      <div className="nw-name">{nameOf(p)}</div>
      <Badges p={p} />
      {p.occupation && <div className="nw-occ">{p.occupation}</div>}
      {p.city && <div className="nw-city">📍 {p.city}</div>}
      <div className="nw-details">
        {p.about && <div className="nw-field"><span className="nw-field-l">О себе</span>{p.about}</div>}
        {p.strengths && <div className="nw-field"><span className="nw-field-l">Сильные стороны</span>{p.strengths}</div>}
        {p.weaknesses && <div className="nw-field"><span className="nw-field-l">Слабые стороны</span>{p.weaknesses}</div>}
        {p.canHelp && <div className="nw-field"><span className="nw-field-l">Чем полезен</span>{p.canHelp}</div>}
        {socialLinks(p).length > 0 && (
          <div className="nw-socials">
            {socialLinks(p).map((s) => (
              <a key={s.k} href={s.v} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>{s.label} ↗</a>
            ))}
          </div>
        )}
      </div>
      <button className="nw-view-profile" onClick={(e) => { e.stopPropagation(); p.userId && onOpenMember?.(p.userId) }}>
        Открыть полный профиль
      </button>
    </div>
  )

  return (
    <div className="networking">
      <Header title="Нетворкинг" />

      <div className="nw-body">
        <div className="nw-tabs">
          <button className={`nw-tab${view === 'swipe' ? ' on' : ''}`} onClick={() => setView('swipe')}>Знакомиться</button>
          <button className={`nw-tab${view === 'pending' ? ' on' : ''}`} onClick={() => setView('pending')}>Избранные</button>
          <button className={`nw-tab${view === 'matches' ? ' on' : ''}`} onClick={() => setView('matches')}>
            Мэтчи{matches.length ? ` · ${matches.length}` : ''}
          </button>
        </div>

        {view === 'swipe' && (
          <>
            <div className="nw-hint">Свайпай карточки: вправо ☕ — на кофе, влево ✕ — мимо. Взаимная симпатия = мэтч.</div>
            <div className="nw-stack">
              {error && <div className="nw-empty">Не удалось загрузить. Проверь соединение.</div>}
              {!error && cards === null && <div className="nw-empty">Загрузка…</div>}
              {!error && cards && !current && (
                <div className="nw-empty">
                  На сегодня все резиденты пересмотрены ☕<br />Загляни позже.
                </div>
              )}
              {current && cards && cards[idx + 1] && <div className="nw-card nw-card-behind" />}
              {current && <Card p={current} top />}
            </div>
            {current && (
              <div className="nw-actions">
                <button className="nw-btn nw-pass" onClick={() => swipe(false)} aria-label="Мимо">✕</button>
                <button className="nw-btn nw-like" onClick={() => swipe(true)} aria-label="На кофе">☕</button>
              </div>
            )}
          </>
        )}

        {view === 'pending' && (
          <div className="nw-pending">
            <div className="nw-hint">Кого ты лайкнул — ждут ответной симпатии. Закрепи до {maxPins} важных (📌) — они наверху.</div>
            {pinMsg && <div className="nw-pin-msg">{pinMsg}</div>}
            {pending === null && <div className="nw-empty">Загрузка…</div>}
            {pending && pending.length === 0 && (
              <div className="nw-empty">Пока пусто. Лайкай резидентов на вкладке «Знакомиться» — они появятся здесь в ожидании мэтча.</div>
            )}
            {pending && pending.map((p) => (
              <div className={`nw-prow${p.pinned ? ' pinned' : ''}`} key={p.userId}>
                <div className="nw-prow-ava" onClick={() => p.userId && onOpenMember?.(p.userId)}>
                  {p.avatar ? <img src={p.avatar} alt="" /> : <span>{initialsOf(p)}</span>}
                </div>
                <div className="nw-prow-info" onClick={() => p.userId && onOpenMember?.(p.userId)}>
                  <div className="nw-prow-name">{nameOf(p)}</div>
                  <Badges p={p} />
                  <div className="nw-prow-wait">⏳ ожидает мэтча</div>
                </div>
                <button className={`nw-pin${p.pinned ? ' on' : ''}`} onClick={() => togglePin(p)} title={p.pinned ? 'Открепить' : 'Закрепить'}>📌</button>
              </div>
            ))}
          </div>
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
                  <Badges p={m} />
                </div>
                <button className="nw-match-write" onClick={() => openTelegram(m)} disabled={!contactHref(m)}>Написать</button>
              </div>
            ))}
          </div>
        )}
      </div>

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
