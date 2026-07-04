import { useEffect, useMemo, useState } from 'react'
import './Community.css'
import './Leaderboard.css' // переиспользуем стили подиума/списка лидеров
import Header from '../components/Header'
import { getProfiles } from '../api'
import type { ProfileData } from '../api'
import { useCatalog } from '../catalog'
import { computeStars } from '../stars'
import Stars from '../components/Stars'
import Spinner from '../components/Spinner'

const MEDALS = ['🥇', '🥈', '🥉']

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function nameOf(p: ProfileData) {
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Участник'
}
function initialsOf(p: ProfileData) {
  return `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}` || 'AP'
}

export default function Community({ onOpenMember }: { onOpenMember?: (id: string) => void }) {
  const [members, setMembers] = useState<ProfileData[] | null>(null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<'residents' | 'leaders'>('residents')
  const catalog = useCatalog()
  // Текущий статус в клубе = название уровня по прогрессу разблокировки.
  const statusOf = (m: ProfileData) => {
    const cur = m.unlock?.current ?? 0
    return cur > 0 ? catalog.levels[cur - 1] : ''
  }
  const totalAch = catalog.achievements.length
  const countOf = (p: ProfileData) => computeStars(p, catalog.achievements)

  useEffect(() => {
    let alive = true
    getProfiles()
      .then((list) => { if (alive) setMembers(list) })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [])

  // Рейтинг для вкладки «Лидеры»: сортировка по звёздам (при равенстве — по имени).
  const leaders = useMemo(() => {
    if (!members) return []
    return [...members].sort((a, b) => countOf(b) - countOf(a) || nameOf(a).localeCompare(nameOf(b)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, catalog.achievements])
  const top3 = leaders.slice(0, 3)
  const podium = [top3[1], top3[0], top3[2]] // порядок мест: 2 · 1 · 3
  const top10 = leaders.slice(0, 10)

  return (
    <div className="community-screen">
      <Header title="Сообщество" />

      <div className="cm-body">
        <div className="cm-tabs">
          <button className={`cm-tab${tab === 'residents' ? ' on' : ''}`} onClick={() => setTab('residents')}>Резиденты</button>
          <button className={`cm-tab${tab === 'leaders' ? ' on' : ''}`} onClick={() => setTab('leaders')}>Лидеры</button>
        </div>

        {error && <div className="cm-empty">Не удалось загрузить список. Проверьте сервер.</div>}
        {!error && members === null && <Spinner />}

        {/* ── Вкладка «Резиденты» ── */}
        {!error && members && tab === 'residents' && (
          <>
            <div className="cm-title-row">
              <div className="cm-title">Участники клуба</div>
              <div className="cm-count">{members.length}</div>
            </div>

            {members.length === 0 && (
              <div className="cm-empty">Пока никто не заполнил профиль. Будь первым — открой свой профиль и нажми «Редактировать».</div>
            )}

            {members.map((m) => {
              const name = nameOf(m)
              const subtitle = m.occupation || m.about || ''
              const status = statusOf(m)
              const stars = countOf(m)
              return (
                <button key={m.userId} className="cm-card" onClick={() => m.userId && onOpenMember?.(m.userId)}>
                  <div className="cm-avatar">
                    {m.avatar ? <img src={m.avatar} alt="" /> : <span>{initialsOf(m)}</span>}
                  </div>
                  <div className="cm-info">
                    <div className="cm-name">{name}</div>
                    <div className="cm-meta">
                      {status && <span className="cm-status">{status}</span>}
                      <span className="cm-stars">★ {stars}</span>
                    </div>
                    {subtitle && <div className="cm-sub">{subtitle}</div>}
                    {m.city && (<div className="cm-city"><PinIcon /> <span>{m.city}</span></div>)}
                  </div>
                  <span className="cm-chevron">›</span>
                </button>
              )
            })}
          </>
        )}

        {/* ── Вкладка «Лидеры» ── */}
        {!error && members && tab === 'leaders' && (
          members.length === 0 ? (
            <div className="cm-empty">Пока нет участников с профилем.</div>
          ) : (
            <>
              {/* Подиум топ-3 */}
              <div className="lb-podium">
                {podium.map((p, idx) => {
                  if (!p) return <div key={idx} className="lb-pod lb-pod-empty" />
                  const place = p === top3[0] ? 1 : p === top3[1] ? 2 : 3
                  return (
                    <button key={p.userId} className={`lb-pod lb-pod-${place}`} onClick={() => p.userId && onOpenMember?.(p.userId)}>
                      <div className="lb-pod-ava">
                        {p.avatar ? <img src={p.avatar} alt="" /> : <span>{initialsOf(p)}</span>}
                        <span className="lb-pod-medal">{MEDALS[place - 1]}</span>
                      </div>
                      <div className="lb-pod-name">{nameOf(p)}</div>
                      <div className="lb-pod-stars"><Stars filled={countOf(p)} total={totalAch} size={10} /></div>
                    </button>
                  )
                })}
              </div>

              {/* Топ-10 списком */}
              <div className="lb-list">
                {top10.map((p, i) => (
                  <button key={p.userId} className="lb-row" onClick={() => p.userId && onOpenMember?.(p.userId)}>
                    <div className="lb-rank">{i < 3 ? MEDALS[i] : `#${i + 1}`}</div>
                    <div className="lb-ava">
                      {p.avatar ? <img src={p.avatar} alt="" /> : <span>{initialsOf(p)}</span>}
                    </div>
                    <div className="lb-info">
                      <div className="lb-name">{nameOf(p)}</div>
                      <div className="lb-sub"><Stars filled={countOf(p)} total={totalAch} size={13} /></div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
