import { useEffect, useState } from 'react'
import './UserCard.css'
import { mockUser } from '../mock'
import { getCurrentUser } from '../tgUser'
import { getMyProfile } from '../api'
import type { ProfileData } from '../api'

export default function UserCard({ onClick }: { onClick?: () => void }) {
  const tg = getCurrentUser()

  // Сохранённый профиль (имя/аватар отражаются здесь после редактирования).
  const [profile, setProfile] = useState<ProfileData | null>(null)
  useEffect(() => {
    let alive = true
    getMyProfile()
      .then(({ profile }) => { if (alive) setProfile(profile) })
      .catch(() => { /* сервер недоступен — показываем Telegram/мок */ })
    return () => { alive = false }
  }, [])

  const firstName = profile?.firstName || tg.firstName
  const lastName = profile?.lastName || tg.lastName
  const avatar = profile?.avatar || tg.avatar
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}` || 'AP'

  return (
    <button className="user-card card" onClick={onClick}>
      <div className="uc-avatar">
        {avatar ? <img src={avatar} alt="" /> : <span>{initials}</span>}
      </div>
      <div className="uc-info">
        <div className="uc-name">{firstName} {lastName}</div>
        <div className="uc-meta">
          <span className="uc-plan">{mockUser.plan}</span>
          <span className="uc-dim">· до {mockUser.planUntil}</span>
        </div>
      </div>
      <span className="uc-chevron">›</span>
    </button>
  )
}
