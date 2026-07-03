import { useEffect, useState } from 'react'
import { getAdminPairs, setBuddy, type BuddyMember } from './api'

// Геймификация: бадди резидентов (текущий месяц). Крестик — авто-перераспределение,
// выпадающий список — ручной выбор бадди.
export default function Pairs() {
  const [members, setMembers] = useState<BuddyMember[]>([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    try { setMembers(await getAdminPairs()) }
    catch (e) { setErr((e as Error).message === 'unauth' ? 'Сессия истекла — войдите заново' : 'Не удалось загрузить') }
  }
  useEffect(() => { load() }, [])

  async function change(id: string, buddyId: string | null) {
    setBusy(id); setMsg('')
    try {
      const r = await setBuddy(id, buddyId)
      setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, buddyId: r.buddyId, buddyName: r.buddyName } : m)))
      setMsg(r.empty ? 'Некого назначить' : buddyId === null ? 'Бадди снят' : buddyId ? 'Бадди назначен ✓' : 'Перераспределено ✓')
    } catch { setMsg('Ошибка') } finally { setBusy('') }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Бадди и пары</h1>
          <div className="page-sub">Кто с кем в бадди этого месяца · можно перераспределить (✕) или выбрать вручную</div>
        </div>
      </div>
      {err && <div className="err">{err}</div>}
      {msg && <div className="msg">{msg}</div>}

      <div className="card">
        {members.length === 0 && <div className="hint">Нет резидентов.</div>}
        {members.map((m) => (
          <div className="buddy-row" key={m.id}>
            <span className="buddy-a">{m.name}</span>
            <span className="buddy-arrow">→</span>
            <select
              className="input"
              value={m.buddyId}
              disabled={busy === m.id}
              onChange={(e) => change(m.id, e.target.value)}
            >
              <option value="">— не назначен —</option>
              {members.filter((o) => o.id !== m.id).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <button className="buddy-x" title="Авто-перераспределение" disabled={busy === m.id} onClick={() => change(m.id, '')}>🎲</button>
            <button className="buddy-x" title="Снять бадди" disabled={busy === m.id} onClick={() => change(m.id, null)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
