import { useMemo } from 'react'
import '../screens/Leaderboard.css'
import { useCatalog } from '../catalog'
import { computeStars } from '../stars'
import Stars from './Stars'
import ResultBadge from './ResultBadge'
import type { ProfileData } from '../api'

const MEDALS = ['🥇', '🥈', '🥉']
const nameOf = (p: ProfileData) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Участник'
const initialsOf = (p: ProfileData) => `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}` || 'AP'

// Общий вид лидерборда: подиум топ-3 + список. Показывает статус в клубе, звёзды
// и максимальный результат за месяц. Используется и на странице «Таблица лидеров»,
// и во вкладке «Лидеры» раздела «Сообщество» (limit=10).
export default function LeadersView({ members, limit, onOpenMember }: {
  members: ProfileData[]; limit?: number; onOpenMember?: (id: string) => void
}) {
  const catalog = useCatalog()
  const totalAch = catalog.achievements.length
  const countOf = (p: ProfileData) => computeStars(p, catalog.achievements)
  const statusOf = (p: ProfileData) => {
    const cur = p.unlock?.current ?? 0
    return cur > 0 ? catalog.levels[cur - 1] : ''
  }
  const sorted = useMemo(
    () => [...members].sort((a, b) => computeStars(b, catalog.achievements) - computeStars(a, catalog.achievements) || nameOf(a).localeCompare(nameOf(b))),
    [members, catalog.achievements],
  )
  const top3 = sorted.slice(0, 3)
  const podium = [top3[1], top3[0], top3[2]] // порядок мест: 2 · 1 · 3
  const list = typeof limit === 'number' ? sorted.slice(0, limit) : sorted

  return (
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
              {statusOf(p) && <div className="lb-pod-status">{statusOf(p)}</div>}
              <div className="lb-pod-stars"><Stars filled={countOf(p)} total={totalAch} size={10} /></div>
              <ResultBadge value={p.maxResult} />
            </button>
          )
        })}
      </div>

      {/* Список */}
      <div className="lb-list">
        {list.map((p, i) => (
          <button key={p.userId} className="lb-row" onClick={() => p.userId && onOpenMember?.(p.userId)}>
            <div className="lb-rank">{i < 3 ? MEDALS[i] : `#${i + 1}`}</div>
            <div className="lb-ava">
              {p.avatar ? <img src={p.avatar} alt="" /> : <span>{initialsOf(p)}</span>}
            </div>
            <div className="lb-info">
              <div className="lb-name">{nameOf(p)}</div>
              <div className="lb-meta">
                {statusOf(p) && <span className="lb-status">{statusOf(p)}</span>}
                <Stars filled={countOf(p)} total={totalAch} size={12} />
              </div>
              <ResultBadge value={p.maxResult} />
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
