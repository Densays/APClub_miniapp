import { useEffect, useState } from 'react'
import './MemberProfile.css'
import Header from '../components/Header'
import { getProfileById } from '../api'
import type { ProfileData } from '../api'
import { useAchievements } from '../catalog'
import { starItems } from '../stars'
import Stars from '../components/Stars'
import Spinner from '../components/Spinner'

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

const SOCIAL_LABELS: { key: keyof NonNullable<ProfileData['social']>; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'web', label: 'Web' },
]

export default function MemberProfile({
  userId,
  onBack,
}: {
  userId: string
  onBack?: () => void
}) {
  const [p, setP] = useState<ProfileData | null>(null)
  const [error, setError] = useState(false)
  const CATALOG = useAchievements()

  useEffect(() => {
    let alive = true
    getProfileById(userId)
      .then((data) => { if (alive) setP(data) })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [userId])

  const name = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Участник' : ''
  const initials = p ? `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}` || 'AP' : ''
  const socials = SOCIAL_LABELS.filter(({ key }) => p?.social?.[key])
  // Звёзды: полученные money-достижения + роли, доведённые до Тира 5.
  const earnedList = starItems(p, CATALOG)

  return (
    <div className="member-profile">
      <Header title="Профиль" onBack={onBack} />

      <div className="mp-body">
        <button className="mp-back" onClick={onBack}>‹ Назад</button>

        {error && <div className="mp-empty">Профиль недоступен.</div>}
        {!error && !p && <Spinner />}

        {p && (
          <>
            <div className="mp-hero">
              <div className="mp-avatar">
                {p.avatar ? <img src={p.avatar} alt="" /> : <span>{initials}</span>}
              </div>
              <div className="mp-name">{name}</div>
              {p.username && <div className="mp-username">@{p.username}</div>}
              {p.occupation && <div className="mp-occupation">{p.occupation}</div>}
            </div>

            {(p.focus || p.city) && (
              <div className="mp-card mp-about">
                {p.focus && <div className="mp-about-bio">{p.focus}</div>}
                {p.city && <div className="mp-row"><PinIcon /><span>{p.city}</span></div>}
              </div>
            )}

            {p.maxResult && (
              <div className="mp-results">
                <div className="mp-result"><span>Максимум за месяц</span><b>{p.maxResult}</b></div>
              </div>
            )}

            <div className="mp-section">
              <div className="mp-section-title">Достижения</div>
              <div className="mp-card mp-ach">
                <div className="mp-ach-stars">
                  <Stars filled={earnedList.length} total={CATALOG.length} size={16} />
                </div>
                {earnedList.length > 0 ? (
                  <div className="mp-ach-list">
                    {earnedList.map((a) => (
                      <div className="mp-ach-item" key={a.id}>
                        <span className="mp-ach-ico">{a.icon}</span>
                        <span className="mp-ach-name">{a.title}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mp-ach-empty">Пока нет достижений</div>
                )}
              </div>
            </div>

            {p.strategies && (
              <div className="mp-section">
                <div className="mp-section-title">Стратегии</div>
                <div className="mp-card mp-text">{p.strategies}</div>
              </div>
            )}
            {p.topics && (
              <div className="mp-section">
                <div className="mp-section-title">Темы для обсуждения</div>
                <div className="mp-card mp-text">{p.topics}</div>
              </div>
            )}
            {p.offer && (
              <div className="mp-section">
                <div className="mp-section-title">Что может предложить</div>
                <div className="mp-card mp-text">{p.offer}</div>
              </div>
            )}

            {socials.length > 0 && (
              <div className="mp-section">
                <div className="mp-section-title">Соцсети</div>
                <div className="mp-card mp-socials">
                  {socials.map(({ key, label }) => (
                    <a
                      key={key}
                      className="mp-social"
                      href={p.social?.[key]}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <span>{label}</span>
                      <span className="mp-social-arrow">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
