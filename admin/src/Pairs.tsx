import { useEffect, useState } from 'react'
import { getAdminPairs, type PairRow } from './api'

// Геймификация: кто с кем в бадди (текущий месяц) + взаимные мэтчи нетворкинга.
export default function Pairs() {
  const [buddies, setBuddies] = useState<PairRow[]>([])
  const [matches, setMatches] = useState<PairRow[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    getAdminPairs()
      .then((d) => { setBuddies(d.buddies); setMatches(d.matches) })
      .catch((e) => setErr((e as Error).message === 'unauth' ? 'Сессия истекла — войдите заново' : 'Не удалось загрузить'))
  }, [])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Бадди и пары</h1>
          <div className="page-sub">Кто с кем в бадди этого месяца и взаимные мэтчи нетворкинга</div>
        </div>
      </div>
      {err && <div className="err">{err}</div>}

      <div className="card">
        <div className="card-t">Бадди этого месяца · {buddies.length}</div>
        {buddies.length === 0 && <div className="hint">Пока никто не выбрал бадди.</div>}
        {buddies.map((p, i) => (
          <div className="pair-row" key={`b${i}`}><b className="gold">{p.aName}</b> → {p.bName}</div>
        ))}
      </div>

      <div className="card">
        <div className="card-t">Взаимные мэтчи нетворкинга · {matches.length}</div>
        {matches.length === 0 && <div className="hint">Пока нет взаимных мэтчей.</div>}
        {matches.map((p, i) => (
          <div className="pair-row" key={`m${i}`}><b className="gold">{p.aName}</b> ↔ <b className="gold">{p.bName}</b></div>
        ))}
      </div>
    </div>
  )
}
