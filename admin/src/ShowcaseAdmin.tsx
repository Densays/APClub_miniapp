import { useEffect, useState } from 'react'
import { getShowcase, saveShowcase, type Perk } from './api'

// Редактор Витрины клуба: перки, которые открываются за N звёзд-достижений.
export default function ShowcaseAdmin() {
  const [perks, setPerks] = useState<Perk[] | null>(null)
  const [msg, setMsg] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => { getShowcase().then(setPerks).catch(() => setPerks([])) }, [])

  function edit(i: number, patch: Partial<Perk>) {
    setPerks((ps) => (ps ? ps.map((p, j) => (j === i ? { ...p, ...patch } : p)) : ps)); setDirty(true)
  }
  function add() { setPerks((ps) => [...(ps ?? []), { stars: 1, title: '', icon: '🎁' }]); setDirty(true) }
  function del(i: number) { setPerks((ps) => (ps ? ps.filter((_, j) => j !== i) : ps)); setDirty(true) }

  async function save() {
    if (!perks) return
    try {
      const cleaned = perks.filter((p) => p.title.trim()).sort((a, b) => a.stars - b.stars)
      setPerks(await saveShowcase(cleaned)); setDirty(false); setMsg('Опубликовано ✓ — уже видно в мини-приложении')
    } catch { setMsg('Ошибка сохранения') }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Витрина клуба</h1>
          <div className="page-sub">Перки, открываемые за звёзды-достижения</div>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={add}>+ Перк</button>
          <button className="btn btn-gold" disabled={!dirty} onClick={save}>Сохранить и опубликовать</button>
        </div>
      </div>
      {msg && <div className="msg">{msg}</div>}

      {perks === null && <div className="td-empty">Загрузка…</div>}
      {perks && perks.length === 0 && <div className="td-empty">Перков нет — добавь первый.</div>}

      <div className="perks">
        {perks?.map((p, i) => (
          <div className="perk" key={i}>
            <input className="input perk-icon" value={p.icon} onChange={(e) => edit(i, { icon: e.target.value })} maxLength={4} />
            <div className="perk-stars">
              <label>Звёзд</label>
              <input className="input num" type="number" min={0} value={p.stars} onChange={(e) => edit(i, { stars: Math.max(0, Number(e.target.value)) })} />
            </div>
            <div className="perk-title">
              <label>Название перка</label>
              <input className="input" value={p.title} onChange={(e) => edit(i, { title: e.target.value })} placeholder="Напр. Доступ к блоку DEX" />
            </div>
            <button className="btn btn-danger sm" onClick={() => del(i)}>Удалить</button>
          </div>
        ))}
      </div>
    </div>
  )
}
