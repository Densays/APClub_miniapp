import { useEffect, useState } from 'react'
import './Achievements.css'
import Header from '../components/Header'
import type { Achievement } from '../mock'
import { getMyProfile, type ProfileData } from '../api'
import { useAchievements } from '../catalog'
import { computeStars, TIER_MAX } from '../stars'
import Stars from '../components/Stars'

export default function Achievements({ onBack }: { onBack?: () => void }) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const achievements = useAchievements()

  useEffect(() => {
    let alive = true
    getMyProfile()
      .then(({ profile }) => { if (alive) setProfile(profile) })
      .catch(() => { /* сервер недоступен — всё как не полученное */ })
    return () => { alive = false }
  }, [])

  const earned = new Set(profile?.achievements ?? [])
  const roleTiers = profile?.roleTiers ?? {}
  const money = achievements.filter((a) => a.group === 'money')
  const roles = achievements.filter((a) => a.group === 'role')
  const starCount = computeStars(profile, achievements)

  // Money-достижение: бинарно получено/нет — каждое даёт звезду.
  const MoneyCard = ({ a }: { a: Achievement }) => {
    const got = earned.has(a.id)
    return (
      <div className={`ach-card${got ? ' is-earned' : ''}`}>
        <div className="ach-icon">{a.icon}</div>
        <div className="ach-title">{a.title}</div>
        <div className="ach-status">{got ? 'Получено' : 'Не получено'}</div>
      </div>
    )
  }

  // Роль: прогресс по тирам. Звезда — только на Тире 5 (legacy: id в achievements = Тир 5).
  const RoleCard = ({ a }: { a: Achievement }) => {
    const tier = earned.has(a.id) ? TIER_MAX : Math.max(0, Math.min(TIER_MAX, roleTiers[a.id] ?? 0))
    const maxed = tier >= TIER_MAX
    return (
      <div className={`ach-card${maxed ? ' is-earned' : ''}`}>
        <div className="ach-icon">{a.icon}</div>
        <div className="ach-title">{a.title}</div>
        <div className="ach-tier-bar">
          {Array.from({ length: TIER_MAX }, (_, i) => (
            <span key={i} className={`ach-tier-pip${i < tier ? ' on' : ''}`} />
          ))}
        </div>
        <div className="ach-status">{maxed ? '★ Тир 5 · звезда' : `Тир ${tier}/${TIER_MAX}`}</div>
      </div>
    )
  }

  return (
    <div className="achievements">
      <Header title="Достижения" onBack={onBack} />

      <div className="ach-body">
        <button className="ach-back" onClick={onBack}>‹ Назад</button>

        <div className="ach-head">
          <div className="ach-head-title">Мои достижения</div>
        </div>
        <div className="ach-head-stars">
          <Stars filled={starCount} total={achievements.length} size={20} />
        </div>

        <div className="ach-section-title">Базовые</div>
        <div className="ach-grid">
          {money.map((a) => <MoneyCard key={a.id} a={a} />)}
        </div>

        <div className="ach-section-title">Роли</div>
        <div className="ach-hint">Каждая роль — 5 тиров. Тир 5 добавляет звезду.</div>
        <div className="ach-grid">
          {roles.map((a) => <RoleCard key={a.id} a={a} />)}
        </div>
      </div>
    </div>
  )
}
