import { useEffect, useState } from 'react'
import { getCatalog, saveCatalog, type Achievement } from './api'

// Редактор каталога достижений (раздел «Геймификация» → Достижения).
// Добавление / правка / удаление определений достижений. Изменения публикуются
// в БД и сразу подхватываются админкой и мини-приложением.
export default function AchievementsAdmin({ onSaved, only }: { onSaved?: (items: Achievement[]) => void; only?: 'money' | 'role' }) {
  const [items, setItems] = useState<Achievement[] | null>(null)
  const [msg, setMsg] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => { getCatalog().then((c) => setItems(c.achievements)).catch(() => setItems([])) }, [])

  function edit(i: number, patch: Partial<Achievement>) {
    setItems((xs) => (xs ? xs.map((a, j) => (j === i ? { ...a, ...patch } : a)) : xs)); setDirty(true)
  }
  function add(group: 'money' | 'role') {
    setItems((xs) => [...(xs ?? []), { id: `ach_${Date.now()}`, title: '', icon: '🏅', group }]); setDirty(true)
  }
  function del(i: number) { setItems((xs) => (xs ? xs.filter((_, j) => j !== i) : xs)); setDirty(true) }

  async function save() {
    if (!items) return
    try {
      const cleaned = items.filter((a) => a.title.trim())
      const saved = await saveCatalog(cleaned)
      setItems(saved); setDirty(false)
      onSaved?.(saved) // обновляем общий каталог → сразу доступно в карточке участника
      setMsg('Опубликовано ✓ — уже видно в мини-приложении и в карточках участников')
    } catch { setMsg('Ошибка сохранения') }
  }

  const ALL_GROUPS: { key: 'money' | 'role'; title: string }[] = [
    { key: 'money', title: 'За деньги / трейдинг' },
    { key: 'role', title: 'Роли в клубе' },
  ]
  const groups = ALL_GROUPS.filter((g) => !only || g.key === only)
  const pageTitle = only === 'role' ? 'Роли в клубе' : only === 'money' ? 'Достижения' : 'Достижения'
  const shownCount = (items ?? []).filter((a) => !only || a.group === only).length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{pageTitle}</h1>
          <div className="page-sub">{only === 'role' ? 'Роли резидентов клуба' : 'Каталог достижений клуба'} · {shownCount} шт</div>
        </div>
        <button className="btn btn-gold" disabled={!dirty} onClick={save}>Сохранить и опубликовать</button>
      </div>
      {msg && <div className="msg">{msg}</div>}
      {items === null && <div className="td-empty">Загрузка…</div>}

      {items && groups.map((g) => (
        <div className="card" key={g.key}>
          <div className="card-t">
            {g.title} <span className="gold">{items.filter((a) => a.group === g.key).length}</span>
          </div>
          <div className="perks">
            {items.map((a, i) => a.group === g.key && (
              <div className="perk ach-row" key={a.id}>
                <input className="input perk-icon" value={a.icon} onChange={(e) => edit(i, { icon: e.target.value })} maxLength={4} />
                <div className="perk-title">
                  <label>{g.key === 'role' ? 'Название роли' : 'Название достижения'}</label>
                  <input className="input" value={a.title} onChange={(e) => edit(i, { title: e.target.value })} placeholder={g.key === 'role' ? 'Напр. Инсайдер клуба' : 'Напр. Первые $1 000'} />
                </div>
                <button className="btn btn-danger sm" onClick={() => del(i)}>Удалить</button>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => add(g.key)}>{g.key === 'role' ? 'Добавить роль' : 'Добавить достижения'}</button>
        </div>
      ))}
    </div>
  )
}
