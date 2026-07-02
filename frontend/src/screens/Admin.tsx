import { useEffect, useState } from 'react'
import './Admin.css'
import Header from '../components/Header'
import { achievements as CATALOG } from '../mock'
import { getProfiles, adminUpdateProfile } from '../api'
import type { ProfileData } from '../api'

const nameOf = (p: ProfileData) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Участник'
const initialsOf = (p: ProfileData) => `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}` || 'AP'

export default function Admin({ onBack }: { onBack?: () => void }) {
  const [users, setUsers] = useState<ProfileData[] | null>(null)
  const [sel, setSel] = useState<ProfileData | null>(null)
  const [ach, setAch] = useState<Set<string>>(new Set())
  const [month, setMonth] = useState(0)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getProfiles().then(setUsers).catch(() => setUsers([]))
  }, [])

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
          <div className="ad-title">Участники ({users?.length ?? 0})</div>
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
