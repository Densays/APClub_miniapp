import { useEffect, useState } from 'react'
import { getAdminPairs, setBuddy, type BuddyMember, type NetMatch } from './api'

// Геймификация: вкладка «Бадди» (взаимные пары месяца, редактируемо) +
// вкладка «Нетворкинг» (взаимные мэтчи резидентов).
export default function Pairs() {
  const [tab, setTab] = useState<'buddy' | 'net'>('buddy')
  const [members, setMembers] = useState<BuddyMember[]>([])
  const [matches, setMatches] = useState<NetMatch[]>([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    try { const d = await getAdminPairs(); setMembers(d.members); setMatches(d.matches) }
    catch (e) { setErr((e as Error).message === 'unauth' ? 'Сессия истекла — войдите заново' : 'Не удалось загрузить') }
  }
  useEffect(() => { load() }, [])

  // Привязка взаимная — после изменения перезагружаем весь список (у партнёра и
  // освобождённых тоже меняется).
  async function change(id: string, buddyId: string | null) {
    setBusy(id); setMsg('')
    try {
      const r = await setBuddy(id, buddyId)
      await load()
      setMsg(r.empty ? 'Некого назначить' : buddyId === null ? 'Бадди снят ✓' : buddyId ? 'Бадди назначен ✓' : 'Перераспределено ✓')
    } catch { setMsg('Ошибка') } finally { setBusy('') }
  }

  const needFixCount = members.filter((m) => m.needsFix).length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Бадди и пары</h1>
          <div className="page-sub">Геймификация: бадди-пары месяца и взаимные мэтчи нетворкинга</div>
        </div>
      </div>

      <div className="pairs-tabs">
        <button className={`btn${tab === 'buddy' ? ' btn-gold' : ' btn-ghost'}`} onClick={() => setTab('buddy')}>Бадди</button>
        <button className={`btn${tab === 'net' ? ' btn-gold' : ' btn-ghost'}`} onClick={() => setTab('net')}>Нетворкинг{matches.length ? ` · ${matches.length}` : ''}</button>
      </div>

      {err && <div className="err">{err}</div>}
      {msg && <div className="msg">{msg}</div>}

      {tab === 'buddy' && (
        <div className="card">
          {needFixCount > 0 && <div className="hint" style={{ color: 'var(--danger)' }}>⚠ Требуют корректировки: {needFixCount} — назначь бадди или перераспредели.</div>}
          {members.length === 0 && <div className="hint">Нет резидентов.</div>}
          {members.map((m) => (
            <div className={`buddy-row${m.needsFix ? ' fix' : ''}`} key={m.id}>
              <span className="buddy-a">{m.name}</span>
              <span className="buddy-arrow">→</span>
              <select className="input" value={m.buddyId} disabled={busy === m.id} onChange={(e) => change(m.id, e.target.value)}>
                <option value="">— не назначен —</option>
                {members.filter((o) => o.id !== m.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <button className="buddy-x" title="Авто-перераспределение" disabled={busy === m.id} onClick={() => change(m.id, '')}>🎲</button>
              <button className="buddy-x" title="Снять бадди" disabled={busy === m.id} onClick={() => change(m.id, null)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'net' && (
        <div className="card">
          <div className="card-t">Взаимные мэтчи резидентов · {matches.length}</div>
          {matches.length === 0 && <div className="hint">Пока нет взаимных мэтчей.</div>}
          {matches.map((p, i) => (
            <div className="buddy-row" key={i}><b className="gold">{p.aName}</b> ↔ <b className="gold">{p.bName}</b></div>
          ))}
        </div>
      )}
    </div>
  )
}
