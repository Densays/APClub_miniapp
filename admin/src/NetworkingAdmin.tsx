import { useEffect, useState } from 'react'
import { getAdminPairs, type NetMember } from './api'

// Геймификация → Нетворкинг: по каждому резиденту — исходящие запросы и статус мэтча.
export default function NetworkingAdmin() {
  const [net, setNet] = useState<NetMember[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    getAdminPairs()
      .then((d) => setNet(d.networking))
      .catch((e) => setErr((e as Error).message === 'unauth' ? 'Сессия истекла — войдите заново' : 'Не удалось загрузить'))
  }, [])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Нетворкинг</h1>
          <div className="page-sub">Все резиденты и их исходящие запросы на знакомство</div>
        </div>
      </div>
      {err && <div className="err">{err}</div>}

      <div className="card">
        <div className="hint"><b className="gold">✓ мэтч</b> (взаимно) · <span className="dim">⏳ ожидает ответа</span></div>
        {net.length === 0 && <div className="hint">Нет резидентов.</div>}
        {net.map((m) => (
          <div className="net-row" key={m.id}>
            <div className="net-name">{m.name}</div>
            {m.sent.length === 0 ? (
              <span className="dim">— запросов нет</span>
            ) : (
              <div className="net-sent">
                {m.sent.map((s, i) => (
                  <span className={`net-chip${s.matched ? ' match' : ''}`} key={i}>{s.matched ? '✓' : '⏳'} {s.name}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
