import { useEffect, useState } from 'react'
import { login, checkAuth, clearToken, getCatalog, type Catalog, type Achievement } from './api'
import Sidebar, { NAV } from './Sidebar'
import Dashboard from './Dashboard'
import Members from './Members'
import Leaders from './Leaders'
import ShowcaseAdmin from './ShowcaseAdmin'
import AchievementsAdmin from './AchievementsAdmin'
import Notifications from './Notifications'

type Theme = 'dark' | 'light'

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('apclub-admin-theme') as Theme) || 'dark')

  useEffect(() => {
    checkAuth().then(setAuthed)
    getCatalog().then(setCatalog).catch(() => setCatalog({ achievements: [], levels: [] }))
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('apclub-admin-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  // После публикации каталога в «Геймификации» обновляем общий catalog, чтобы
  // новые достижения сразу были доступны в карточке участника.
  const onCatalogChange = (achievements: Achievement[]) =>
    setCatalog((c) => ({ achievements, levels: c?.levels ?? [] }))

  if (authed === null) return <div className="center dim">Загрузка…</div>
  if (!authed) return <Login onOk={() => setAuthed(true)} />
  return <Shell catalog={catalog} theme={theme} onToggleTheme={toggleTheme} onCatalogChange={onCatalogChange} onLogout={() => { clearToken(); setAuthed(false) }} />
}

// ── Вход ──────────────────────────────────────────────────────────────────────
function Login({ onOk }: { onOk: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try { await login(pw); onOk() }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="center">
      <form className="login" onSubmit={submit}>
        <div className="login-brand"><span className="sb-logo lg">AP</span></div>
        <div className="login-title">AP Club · Админ панель</div>
        <div className="login-sub">Панель управления сообществом</div>
        <input className="input" type="password" placeholder="Пароль" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <div className="err">{err}</div>}
        <button className="btn btn-gold" disabled={busy || !pw}>{busy ? 'Вход…' : 'Войти'}</button>
      </form>
    </div>
  )
}

// ── Оболочка с сайдбаром ──────────────────────────────────────────────────────
const LABELS: Record<string, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items.map((i) => [i.key, i.label])),
)

function Shell({ catalog, theme, onToggleTheme, onCatalogChange, onLogout }: {
  catalog: Catalog | null; theme: Theme; onToggleTheme: () => void
  onCatalogChange: (achievements: Achievement[]) => void; onLogout: () => void
}) {
  const [section, setSection] = useState('dashboard')

  function render() {
    switch (section) {
      case 'dashboard': return <Dashboard />
      case 'members': return <Members catalog={catalog} />
      case 'leaders': return <Leaders />
      case 'showcase': return <ShowcaseAdmin />
      case 'achievements': return <AchievementsAdmin onSaved={onCatalogChange} />
      case 'notifications': return <Notifications />
      default: return <Stub title={LABELS[section] ?? 'Раздел'} />
    }
  }

  return (
    <div className="layout">
      <Sidebar current={section} onSelect={setSection} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
      <main className="content">{render()}</main>
    </div>
  )
}

function Stub({ title }: { title: string }) {
  return (
    <div className="page">
      <div className="page-head"><div>
        <h1 className="page-title">{title}</h1>
        <div className="page-sub">Раздел в разработке — наполним по мере необходимости</div>
      </div></div>
      <div className="stub-box">Раздел «{title}» скоро наполним содержимым.</div>
    </div>
  )
}
