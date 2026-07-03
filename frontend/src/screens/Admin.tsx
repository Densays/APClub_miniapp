import { useEffect, useState } from 'react'
import './Admin.css'
import Header from '../components/Header'
import { achievements as CATALOG } from '../mock'
import { getProfiles, adminUpdateProfile, getShowcase, saveShowcase, getAdminPairs } from '../api'
import type { ProfileData, Perk, PairRow } from '../api'

const nameOf = (p: ProfileData) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Участник'
const initialsOf = (p: ProfileData) => `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}` || 'AP'

export default function Admin({ onBack }: { onBack?: () => void }) {
  const [users, setUsers] = useState<ProfileData[] | null>(null)
  const [sel, setSel] = useState<ProfileData | null>(null)
  const [ach, setAch] = useState<Set<string>>(new Set())
  const [month, setMonth] = useState(0)
  const [msg, setMsg] = useState('')
  const [perks, setPerks] = useState<Perk[]>([])
  const [scMsg, setScMsg] = useState('')
  const [pairs, setPairs] = useState<{ buddies: PairRow[]; matches: PairRow[] }>({ buddies: [], matches: [] })

  useEffect(() => {
    getProfiles().then(setUsers).catch(() => setUsers([]))
    getShowcase().then(setPerks).catch(() => {})
    getAdminPairs().then(setPairs).catch(() => {})
  }, [])

  const editPerk = (i: number, patch: Partial<Perk>) => setPerks((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const addPerk = () => setPerks((ps) => [...ps, { stars: 1, title: '', icon: '🎁' }])
  const removePerk = (i: number) => setPerks((ps) => ps.filter((_, j) => j !== i))
  async function saveSc() {
    try { setPerks(await saveShowcase(perks.filter((p) => p.title.trim()).sort((a, b) => a.stars - b.stars))); setScMsg('Витрина сохранена ✓') }
    catch { setScMsg('Ошибка сохранения') }
  }

  function pick(u: ProfileData) {
    setSel(u)
    setAch(new Set(u.achievements ?? []))
    setMonth(0)
    setMsg('')
  }
  function refresh(p: ProfileData) {
    setUsers((us) => (us ? us.map((u) => (u.userId === p.userId ? p : u)) : us))
    setSel(p)
  }
  function toggle(id: string) {
    setAch((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  async function saveAch() {
    if (!sel?.userId) return
    try {
      const p = await adminUpdateProfile(sel.userId, { achievements: Array.from(ach) })
      refresh(p)
      setMsg('Достижения сохранены ✓')
    } catch { setMsg('Ошибка сохранения') }
  }
  async function saveMonth() {
    if (!sel?.userId) return
    try {
      const p = await adminUpdateProfile(sel.userId, { setMonth: month })
      refresh(p)
      setMsg(`Открыто месяцев: ${month} ✓`)
    } catch { setMsg('Ошибка сохранения') }
  }

  // ── Список участников ──
  if (!sel) {
    return (
      <div className="admin">
        <Header title="Админ-панель" onBack={onBack} />
        <div className="ad-body">
          <button className="ad-back" onClick={onBack}>‹ Назад</button>

          {/* Витрина клуба */}
          <div className="ad-title">Витрина клуба</div>
          {scMsg && <div className="ad-msg">{scMsg}</div>}
          {perks.map((p, i) => (
            <div className="ad-perk" key={i}>
              <input className="ad-perk-icon" value={p.icon} onChange={(e) => editPerk(i, { icon: e.target.value })} />
              <input className="ad-perk-star" type="number" min={0} value={p.stars} onChange={(e) => editPerk(i, { stars: Math.max(0, Number(e.target.value)) })} />
              <input className="ad-perk-title" placeholder="Название перка" value={p.title} onChange={(e) => editPerk(i, { title: e.target.value })} />
              <button className="ad-perk-x" onClick={() => removePerk(i)}>×</button>
            </div>
          ))}
          <div className="ad-row">
            <button className="ad-btn-ghost" onClick={addPerk}>+ Перк</button>
            <button className="ad-btn" onClick={saveSc}>Сохранить витрину</button>
          </div>

          {/* Геймификация: бадди и пары */}
          <div className="ad-title" style={{ marginTop: 18 }}>Бадди и пары</div>
          <div className="ad-sub-t">Бадди этого месяца</div>
          {pairs.buddies.length === 0 && <div className="ad-empty-s">Пока никто не выбрал бадди.</div>}
          {pairs.buddies.map((p, i) => (
            <div className="ad-pair" key={`b${i}`}><b>{p.aName}</b> → {p.bName}</div>
          ))}
          <div className="ad-sub-t">Взаимные мэтчи нетворкинга</div>
          {pairs.matches.length === 0 && <div className="ad-empty-s">Пока нет взаимных мэтчей.</div>}
          {pairs.matches.map((p, i) => (
            <div className="ad-pair" key={`m${i}`}><b>{p.aName}</b> ↔ <b>{p.bName}</b></div>
          ))}

          <div className="ad-title" style={{ marginTop: 18 }}>Участники ({users?.length ?? 0})</div>
          {users === null && <div className="ad-empty">Загрузка…</div>}
          {users?.map((u) => (
            <button className="ad-user" key={u.userId} onClick={() => pick(u)}>
              <div className="ad-user-ava">
                {u.avatar ? <img src={u.avatar} alt="" /> : <span>{initialsOf(u)}</span>}
              </div>
              <div className="ad-user-name">{nameOf(u)}</div>
              <span className="ad-user-star">★ {(u.achievements ?? []).length}</span>
              <span className="ad-chevron">›</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Редактор участника ──
  return (
    <div className="admin">
      <Header title="Админ-панель" onBack={onBack} />
      <div className="ad-body">
        <button className="ad-back" onClick={() => setSel(null)}>‹ К списку</button>
        <div className="ad-title">{nameOf(sel)}</div>
        {msg && <div className="ad-msg">{msg}</div>}

        <div className="ad-block">
          <div className="ad-block-t">Прогресс разблокировки</div>
          <div className="ad-row">
            <input
              type="number" min={0} max={12} className="ad-input"
              value={month} onChange={(e) => setMonth(Math.max(0, Math.min(12, Number(e.target.value))))}
            />
            <button className="ad-btn" onClick={saveMonth}>Установить месяц</button>
          </div>
          <div className="ad-hint">Открыть участнику N месяцев (0–12). Дальше идёт автоматически.</div>
        </div>

        <div className="ad-block">
          <div className="ad-block-t">Достижения — {ach.size}/{CATALOG.length} ★</div>
          <div className="ad-ach-grid">
            {CATALOG.map((a) => (
              <button key={a.id} className={`ad-ach${ach.has(a.id) ? ' on' : ''}`} onClick={() => toggle(a.id)}>
                <span className="ad-ach-i">{a.icon}</span>
                <span className="ad-ach-t">{a.title}</span>
              </button>
            ))}
          </div>
          <button className="ad-btn ad-btn-wide" onClick={saveAch}>Сохранить достижения</button>
        </div>
      </div>
    </div>
  )
}
