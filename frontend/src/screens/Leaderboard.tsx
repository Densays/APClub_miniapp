import { useEffect, useState } from 'react'
import './Leaderboard.css'
import Header from '../components/Header'
import { getProfiles } from '../api'
import type { ProfileData } from '../api'
import LeadersView from '../components/LeadersView'
import Spinner from '../components/Spinner'

export default function Leaderboard({ onBack, onOpenMember }: { onBack?: () => void; onOpenMember?: (id: string) => void }) {
  const [rows, setRows] = useState<ProfileData[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    getProfiles()
      .then((list) => { if (alive) setRows(list) })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [])

  return (
    <div className="leaderboard">
      <Header title="Таблица лидеров" onBack={onBack} />

      <div className="lb-body">
        <button className="lb-back" onClick={onBack}>‹ Назад</button>

        {error && <div className="lb-empty">Не удалось загрузить рейтинг.</div>}
        {!error && rows === null && <Spinner />}
        {!error && rows && rows.length === 0 && (
          <div className="lb-empty">Пока нет участников с профилем.</div>
        )}

        {rows && rows.length > 0 && <LeadersView members={rows} onOpenMember={onOpenMember} />}
      </div>
    </div>
  )
}
