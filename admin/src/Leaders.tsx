import { useEffect, useState } from 'react'
import { getProfiles, type Profile, type Catalog } from './api'
import { computeStars } from './stars'

const nameOf = (p: Profile) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Без имени'
const initialsOf = (p: Profile) => (`${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() || 'AP')

function Ava({ p, size = 40 }: { p: Profile; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>{p.avatar ? <img src={p.avatar} alt="" /> : initialsOf(p)}</span>
}

export default function Leaders({ catalog, onOpenMember }: { catalog: Catalog | null; onOpenMember?: (id: string) => void }) {
  const [rows, setRows] = useState<Profile[] | null>(null)
  const cat = catalog?.achievements ?? []
  const stars = (p: Profile) => computeStars(p, cat)

  useEffect(() => {
    getProfiles()
      .then((list) => setRows([...list].sort((a, b) => computeStars(b, cat) - computeStars(a, cat) || nameOf(a).localeCompare(nameOf(b)))))
      .catch(() => setRows([]))
  }, [catalog])

  const medal = ['🥇', '🥈', '🥉']

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Таблица лидеров</h1>
          <div className="page-sub">Рейтинг резидентов по числу достижений</div>
        </div>
      </div>

      {rows === null && <div className="td-empty">Загрузка…</div>}
      {rows && rows.length === 0 && <div className="td-empty">Пока нет участников</div>}

      {rows && rows.length > 0 && (
        <>
          <div className="podium">
            {[1, 0, 2].map((i) => rows[i] && (
              <div className={`pod pod-${i}`} key={rows[i].userId}>
                <div className="pod-medal">{medal[i]}</div>
                <Ava p={rows[i]} size={i === 0 ? 66 : 52} />
                <div className="pod-name">{nameOf(rows[i])}</div>
                <div className="pod-stars gold">★ {stars(rows[i])}</div>
              </div>
            ))}
          </div>

          <div className="table">
            {rows.map((p, i) => (
              <div className="tr row static lead-row" key={p.userId}>
                <span className="rank">{i < 3 ? medal[i] : `#${i + 1}`}</span>
                <span className="td-name"><Ava p={p} />
                  <span className="td-name-txt">
                    <span className="td-name-1">{nameOf(p)}</span>
                    <span className="td-name-2">{p.username ? `@${p.username}` : `id ${p.userId}`}</span>
                  </span>
                </span>
                <span className="td-col"><b className="gold">★ {stars(p)}</b></span>
                {onOpenMember && (
                  <button className="lead-open" onClick={() => onOpenMember(p.userId)}>Перейти <span className="lead-open-arr">›</span></button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
