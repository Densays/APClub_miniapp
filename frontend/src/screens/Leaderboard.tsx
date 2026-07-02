import { useEffect, useState } from 'react'
import './Leaderboard.css'
import Header from '../components/Header'
import { getProfiles } from '../api'
import type { ProfileData } from '../api'
import { useAchievements } from '../catalog'
import Stars from '../components/Stars'

const MEDALS = ['🥇', '🥈', '🥉']

function nameOf(p: ProfileData) {
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Участник'
}
function initialsOf(p: ProfileData) {
  return `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}` || 'AP'
}
function countOf(p: ProfileData) {
  return p.achievements?.length ?? 0
}

export default function Leaderboard({ onBack, onOpenMember }: { onBack?: () => void; onOpenMember?: (id: string) => void }) {
  const [rows, setRows] = useState<ProfileData[] | null>(null)
  const [error, setError] = useState(false)
  const TOTAL_ACH = useAchievements().length

  useEffect(() => {
    let alive = true
    getProfiles()
      .then((list) => {
        if (!alive) return
        const sorted = [...list].sort((a, b) => countOf(b) - countOf(a) || nameOf(a).localeCompare(nameOf(b)))
        setRows(sorted)
      })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [])

  const top3 = rows?.slice(0, 3) ?? []
  // Порядок мест на подиуме: 2 · 1 · 3
  const podium = [top3[1], top3[0], top3[2]]

  return (
    <div className="leaderboard">
      <Header title="Таблица лидеров" onBack={onBack} />

      <div className="lb-body">
        <button className="lb-back" onClick={onBack}>‹ Назад</button>

        {error && <div className="lb-empty">Не удалось загрузить рейтинг.</div>}
        {!error && rows === null && <div className="lb-empty">Загрузка…</div>}
        {!error && rows && rows.length === 0 && (
          <div className="lb-empty">Пока нет участников с профилем.</div>
        )}

        {rows && rows.length > 0 && (
          <>
            {/* Подиум топ-3 */}
            <div className="lb-podium">
              {podium.map((p, idx) => {
                if (!p) return <div key={idx} className="lb-pod lb-pod-empty" />
                const place = p === top3[0] ? 1 : p === top3[1] ? 2 : 3
                return (
                  <button
                    key={p.userId}
                    className={`lb-pod lb-pod-${place}`}
                    onClick={() => p.userId && onOpenMember?.(p.userId)}
                  >
                    <div className="lb-pod-ava">
                      {p.avatar ? <img src={p.avatar} alt="" /> : <span>{initialsOf(p)}</span>}
                      <span className="lb-pod-medal">{MEDALS[place - 1]}</span>
                    </div>
                    <div className="lb-pod-name">{nameOf(p)}</div>
                    <div className="lb-pod-stars"><Stars filled={countOf(p)} total={TOTAL_ACH} size={10} /></div>
                  </button>
                )
              })}
            </div>

            {/* Полный список */}
            <div className="lb-list">
              {rows.map((p, i) => (
                <button
                  key={p.userId}
                  className="lb-row"
                  onClick={() => p.userId && onOpenMember?.(p.userId)}
                >
                  <div className="lb-rank">{i < 3 ? MEDALS[i] : `#${i + 1}`}</div>
                  <div className="lb-ava">
                    {p.avatar ? <img src={p.avatar} alt="" /> : <span>{initialsOf(p)}</span>}
                  </div>
                  <div className="lb-info">
                    <div className="lb-name">{nameOf(p)}</div>
                    <div className="lb-sub"><Stars filled={countOf(p)} total={TOTAL_ACH} size={13} /></div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
