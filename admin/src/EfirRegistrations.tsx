import { useEffect, useState } from 'react'
import { getEfirRegistrations, type EfirRegistration } from './api'
import { TgButton } from './TgButton'

const dateStr = (key: string) => {
  const [y, m, d] = key.split('-')
  return `${d}.${m}.${y}`
}
const timeStr = (ts: number) => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const shiftDate = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Раздел «Эфир в клубе — регистрации»: кто нажал «Войти» в мини-аппе на этой
// неделе — отдельная аналитика посещаемости эфиров (не общий список участников).
export default function EfirRegistrations() {
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState('19:00')
  const [regs, setRegs] = useState<EfirRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  function load(d?: string) {
    setLoading(true); setErr('')
    getEfirRegistrations(d)
      .then((r) => { setDate(r.date); setTime(r.time); setRegs(r.registrations) })
      .catch((e) => setErr((e as Error).message === 'unauth' ? 'Сессия истекла — войдите заново' : 'Не удалось загрузить список'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Эфир в клубе — регистрации</h1>
          <div className="page-sub">Чт {time} МСК{date ? ` · ${dateStr(date)}` : ''} · зарегистрировалось {regs.length}</div>
        </div>
        <div className="row">
          <button className="btn btn-ghost" disabled={!date} onClick={() => date && load(shiftDate(date, -7))}>‹ Пред. неделя</button>
          <button className="btn btn-ghost" disabled={!date} onClick={() => date && load(shiftDate(date, 7))}>След. неделя ›</button>
        </div>
      </div>

      <div className="hint">
        Список пополняется, когда резидент жмёт «Войти» на карточке «Эфир в клубе» в мини-приложении —
        только после этого он получает ссылку на комнату. Каждая регистрация также приходит вам в бота.
      </div>

      {err && <div className="err">{err}</div>}
      {loading && <div className="td-empty">Загрузка…</div>}
      {!loading && !err && regs.length === 0 && <div className="td-empty">Пока никто не зарегистрировался на этот эфир.</div>}

      {!loading && regs.length > 0 && (
        <div className="ef-table">
          <div className="ef-row th">
            <span>Имя</span>
            <span>Telegram</span>
            <span>Время регистрации</span>
          </div>
          {regs.map((r) => (
            <div className="ef-row" key={r.userId}>
              <span className="al-member"><b>{r.name}</b></span>
              <span className="ef-tg">
                {r.username ? <span className="al-handle">@{r.username}</span> : <span className="muted">нет ника</span>}
                <TgButton p={{ username: r.username, userId: r.userId }} />
              </span>
              <span className="ef-ts">{timeStr(r.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
