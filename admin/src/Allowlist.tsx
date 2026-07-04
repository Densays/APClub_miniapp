import { useEffect, useMemo, useState } from 'react'
import { getAllowlist, saveAllowlist, getProfiles, type Profile } from './api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const norm = (e: string) => e.trim().toLowerCase()
const nameOf = (p: Profile) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Без имени'
const dateStr = (ts?: number) => (ts ? new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

// Раздел «Доступ по почте»: единый список email, которым разрешён вход в кабинет.
// Таблица сопоставляет каждую почту с профилем участника (если он вошёл): данные,
// статус/срок доступа, переход в карточку. Пользователь при регистрации должен
// указать почту из этого списка (иначе — отказ).
export default function Allowlist({ onOpenMember }: { onOpenMember?: (id: string) => void }) {
  const [emails, setEmails] = useState<string[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
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
    // Профили — чтобы показать данные участника рядом с почтой (не критично).
    getProfiles().then(setProfiles).catch(() => setProfiles([]))
  }, [])

  // Карта нормализованная почта → профиль участника (кто уже вошёл по этой почте).
  const byEmail = useMemo(() => {
    const m = new Map<string, Profile>()
    for (const p of profiles) { const e = norm(p.email ?? ''); if (e) m.set(e, p) }
    return m
  }, [profiles])

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

  const registered = emails.filter((e) => byEmail.has(e)).length

  function accessBadge(p?: Profile) {
    if (!p) return <span className="badge">не зарегистрирован</span>
    if (p.access?.active === false) return <span className="badge red">доступ истёк {dateStr(p.accessUntil)}</span>
    if (p.accessUntil) return <span className="badge green">активен до {dateStr(p.accessUntil)}{p.billingPeriod ? '' : ''}</span>
    return <span className="badge green">♾ бессрочно</span>
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Доступ по почте</h1>
          <div className="page-sub">Вход только для почт из списка · всего {emails.length} · вошли {registered}</div>
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

      {!loaded && <div className="td-empty">Загрузка…</div>}
      {loaded && emails.length === 0 && <div className="td-empty">Список пуст — добавь первую почту.</div>}

      {loaded && emails.length > 0 && (
        <div className="al-table">
          <div className="al-row th">
            <span>Почта</span>
            <span>Участник</span>
            <span>Доступ</span>
            <span>Действия</span>
          </div>
          {filtered.map((e) => {
            const p = byEmail.get(e)
            return (
              <div className="al-row" key={e}>
                <span className="al-email" title={e}>{e}</span>
                <span className="al-member">
                  {p
                    ? <><b>{nameOf(p)}</b>{p.username && <span className="al-handle">@{p.username}</span>}</>
                    : <span className="muted">ещё не вошёл</span>}
                </span>
                <span className="al-access">{accessBadge(p)}</span>
                <span className="al-actions">
                  {p && <button className="btn btn-ghost sm" onClick={() => onOpenMember?.(p.userId)}>Перейти ›</button>}
                  <button className="chip-x" title="Убрать почту из списка" onClick={() => remove(e)}>×</button>
                </span>
              </div>
            )
          })}
          {filtered.length === 0 && <div className="td-empty">Ничего не найдено</div>}
        </div>
      )}
    </div>
  )
}
