import { useEffect, useMemo, useState } from 'react'
import { getAllowlist, saveAllowlist } from './api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const norm = (e: string) => e.trim().toLowerCase()

// Раздел «Доступ по почте»: единый список email, которым разрешён вход в кабинет.
// Пользователь при регистрации должен указать почту из этого списка (иначе — отказ).
export default function Allowlist() {
  const [emails, setEmails] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    getAllowlist()
      .then((list) => { setEmails(list); setLoaded(true) })
      .catch((e) => setErr((e as Error).message === 'unauth' ? 'Сессия истекла — войдите заново' : 'Не удалось загрузить список'))
  }, [])

  // Добавление: можно вставить несколько через запятую/пробел/перенос строки.
  function add() {
    const parts = input.split(/[\s,;]+/).map(norm).filter(Boolean)
    if (!parts.length) return
    const bad = parts.filter((p) => !EMAIL_RE.test(p))
    if (bad.length) { setErr(`Не похоже на почту: ${bad.slice(0, 3).join(', ')}`); return }
    setErr('')
    setEmails((cur) => {
      const set = new Set(cur)
      let added = 0
      for (const p of parts) if (!set.has(p)) { set.add(p); added++ }
      if (added) { setDirty(true); setMsg(`Добавлено: ${added}`) }
      return [...set]
    })
    setInput('')
  }
  function remove(e: string) { setEmails((cur) => cur.filter((x) => x !== e)); setDirty(true); setMsg('') }

  async function save() {
    setBusy(true); setErr(''); setMsg('')
    try { setEmails(await saveAllowlist(emails)); setDirty(false); setMsg('Список сохранён ✓ — вход разрешён только этим почтам') }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? emails.filter((e) => e.includes(s)) : emails
  }, [emails, q])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Доступ по почте</h1>
          <div className="page-sub">Вход в кабинет только для почт из списка · {emails.length}</div>
        </div>
        <button className="btn btn-gold" disabled={!dirty || busy} onClick={save}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
      </div>

      <div className="hint">
        Пользователь при регистрации указывает имя, фамилию и почту. Если почты нет в списке — доступ закрыт.
        Одна почта = один аккаунт (повторно занять под другим именем нельзя). Список пуст = гейт выключен (пускаем всех).
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <input
          className="input"
          placeholder="Добавить почту (можно несколько через запятую)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn btn-ghost" onClick={add}>+ Добавить</button>
      </div>
      {err && <div className="err">{err}</div>}
      {msg && <div className="msg">{msg}</div>}

      {emails.length > 8 && (
        <input className="input search" placeholder="Поиск по списку" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      <div className="tags" style={{ marginTop: 12 }}>
        {!loaded && <span className="hint">Загрузка…</span>}
        {loaded && emails.length === 0 && <span className="hint">Список пуст — добавь первую почту.</span>}
        {filtered.map((e) => (
          <span className="tag" key={e}>{e}<button className="tag-x" onClick={() => remove(e)}>×</button></span>
        ))}
      </div>
    </div>
  )
}
