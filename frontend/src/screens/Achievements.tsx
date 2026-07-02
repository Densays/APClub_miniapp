import { useEffect, useState } from 'react'
import './Achievements.css'
import Header from '../components/Header'
import type { Achievement } from '../mock'
import { getMyProfile } from '../api'
import { useAchievements } from '../catalog'
import Stars from '../components/Stars'

export default function Achievements({ onBack }: { onBack?: () => void }) {
  const [earned, setEarned] = useState<Set<string>>(new Set())
  const achievements = useAchievements()

  useEffect(() => {
    let alive = true
    getMyProfile()
      .then(({ profile }) => {
        if (alive) setEarned(new Set(profile.achievements ?? []))
      })
      .catch(() => { /* сервер недоступен — всё как не полученное */ })
    return () => { alive = false }
  }, [])

  const money = achievements.filter((a) => a.group === 'money')
  const roles = achievements.filter((a) => a.group === 'role')
  const earnedCount = achievements.filter((a) => earned.has(a.id)).length

  const Card = ({ a }: { a: Achievement }) => {
    const got = earned.has(a.id)
    return (
      <div className={`ach-card${got ? ' is-earned' : ''}`}>
        <div className="ach-icon">{a.icon}</div>
        <div className="ach-title">{a.title}</div>
        <div className="ach-status">{got ? 'Получено' : 'Не получено'}</div>
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
          <Stars filled={earnedCount} total={achievements.length} size={20} />
        </div>

        <div className="ach-section-title">Базовые</div>
        <div className="ach-grid">
          {money.map((a) => <Card key={a.id} a={a} />)}
        </div>

        <div className="ach-section-title">Дополнительные</div>
        <div className="ach-grid">
          {roles.map((a) => <Card key={a.id} a={a} />)}
        </div>
      </div>
    </div>
  )
}
