import { useEffect, useState } from 'react'
import './Showcase.css'
import Header from '../components/Header'
import Stars from '../components/Stars'
import { clubPerks } from '../mock'
import { getMyProfile, getShowcase, type Perk, type ProfileData } from '../api'
import { useAchievements } from '../catalog'
import { computeStars } from '../stars'

export default function Showcase({ onBack }: { onBack?: () => void }) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const CATALOG = useAchievements()
  const stars = computeStars(profile, CATALOG)
  // Перки берём из БД (то, что настроено в админке); mock — фолбэк.
  const [perks, setPerks] = useState<Perk[]>(clubPerks)

  useEffect(() => {
    let alive = true
    getMyProfile()
      .then(({ profile }) => { if (alive) setProfile(profile) })
      .catch(() => {})
    getShowcase()
      .then((list) => { if (alive && list.length) setPerks(list) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return (
    <div className="showcase">
      <Header title="Витрина клуба" onBack={onBack} />
      <div className="sc-body">
        <button className="sc-back" onClick={onBack}>‹ Назад</button>

        <div className="sc-head">
          <div className="sc-head-title">Твои звёзды</div>
          <Stars filled={stars} total={CATALOG.length} size={18} />
          <div className="sc-head-sub">Открывай возможности клуба, зарабатывая звёзды за достижения</div>
        </div>

        <div className="sc-list">
          {perks.map((p) => {
            const unlocked = stars >= p.stars
            return (
              <div className={`sc-perk${unlocked ? ' is-open' : ''}`} key={p.stars}>
                <div className="sc-perk-icon">{unlocked ? p.icon : '🔒'}</div>
                <div className="sc-perk-text">
                  <div className="sc-perk-title">{p.title}</div>
                  <div className="sc-perk-req">
                    {p.stars} {p.stars === 1 ? 'звезда' : p.stars < 5 ? 'звезды' : 'звёзд'}
                  </div>
                </div>
                <div className="sc-perk-status">{unlocked ? 'Доступно' : 'Закрыто'}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
