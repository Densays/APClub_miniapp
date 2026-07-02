import { useEffect, useState } from 'react'
import './Community.css'
import Header from '../components/Header'
import { getProfiles } from '../api'
import type { ProfileData } from '../api'

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
        <div className="cm-title-row">
          <div className="cm-title">Участники клуба</div>
          {members && <div className="cm-count">{members.length}</div>}
        </div>

        {error && <div className="cm-empty">Не удалось загрузить список. Проверьте сервер.</div>}

        {!error && members === null && <div className="cm-empty">Загрузка…</div>}

        {!error && members && members.length === 0 && (
          <div className="cm-empty">Пока никто не заполнил профиль. Будь первым — открой свой профиль и нажми «Редактировать».</div>
        )}

        {members?.map((m) => {
          const name = `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || 'Участник'
          const subtitle = m.occupation || m.about || ''
          return (
            <button
              key={m.userId}
              className="cm-card"
              onClick={() => m.userId && onOpenMember?.(m.userId)}
            >
              <div className="cm-avatar">
                {m.avatar ? <img src={m.avatar} alt="" /> : <span>{initialsOf(m)}</span>}
              </div>
              <div className="cm-info">
                <div className="cm-name">{name}</div>
                {subtitle && <div className="cm-sub">{subtitle}</div>}
                {m.city && (
                  <div className="cm-city"><PinIcon /> <span>{m.city}</span></div>
                )}
              </div>
              <span className="cm-chevron">›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
