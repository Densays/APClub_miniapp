import { useEffect, useState } from 'react'
import './Community.css'
import Header from '../components/Header'
import { getProfiles } from '../api'
import type { ProfileData } from '../api'
import { useCatalog } from '../catalog'
import { computeStars } from '../stars'
import LeadersView from '../components/LeadersView'
import Spinner from '../components/Spinner'

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
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

  useEffect(() => {
    let alive = true
    getProfiles()
      .then((list) => { if (alive) setMembers(list) })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [])

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
              const name = `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || 'Участник'
              const subtitle = m.occupation || m.about || ''
              const status = statusOf(m)
              const stars = computeStars(m, catalog.achievements)
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

        {/* ── Вкладка «Лидеры» (общий компонент, топ-10) ── */}
        {!error && members && tab === 'leaders' && (
          members.length === 0
            ? <div className="cm-empty">Пока нет участников с профилем.</div>
            : <LeadersView members={members} limit={10} onOpenMember={onOpenMember} />
        )}
      </div>
    </div>
  )
}
