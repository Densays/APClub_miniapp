import { useEffect, useState } from 'react'
import { login, checkAuth, clearToken, getCatalog, type Catalog, type Achievement } from './api'
import Sidebar, { NAV } from './Sidebar'
import Dashboard from './Dashboard'
import Members from './Members'
import Leaders from './Leaders'
import ShowcaseAdmin from './ShowcaseAdmin'
import AchievementsAdmin from './AchievementsAdmin'
import Notifications from './Notifications'
import Allowlist from './Allowlist'
import Pairs from './Pairs'
import NetworkingAdmin from './NetworkingAdmin'
import EfirRegistrations from './EfirRegistrations'

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
  // Правки названий уровней (из карточки участника) — обновляем общий каталог.
  const onLevelsChange = (levels: string[]) =>
    setCatalog((c) => ({ achievements: c?.achievements ?? [], levels }))

  if (authed === null) return <div className="center dim">Загрузка…</div>
  if (!authed) return <Login onOk={() => setAuthed(true)} />
  return <Shell catalog={catalog} theme={theme} onToggleTheme={toggleTheme} onCatalogChange={onCatalogChange} onLevelsChange={onLevelsChange} onLogout={() => { clearToken(); setAuthed(false) }} />
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

function Shell({ catalog, theme, onToggleTheme, onCatalogChange, onLevelsChange, onLogout }: {
  catalog: Catalog | null; theme: Theme; onToggleTheme: () => void
  onCatalogChange: (achievements: Achievement[]) => void
  onLevelsChange: (levels: string[]) => void; onLogout: () => void
}) {
  const [section, setSection] = useState('dashboard')
  const [openMemberId, setOpenMemberId] = useState<string | null>(null)
  const [membersFilter, setMembersFilter] = useState('all')

  // Открыть карточку участника (напр. из таблицы лидеров/дашборда/доступа).
  const openMember = (id: string) => { setOpenMemberId(id); setSection('members') }
  // Открыть список участников с фильтром по сегменту (клик по KPI-карточке).
  const openMembers = (filter: string) => { setOpenMemberId(null); setMembersFilter(filter); setSection('members') }
  // Клик по пункту сайдбара всегда сбрасывает открытого участника (возврат к списку).
  const selectSection = (key: string) => { setOpenMemberId(null); if (key === 'members') setMembersFilter('all'); setSection(key) }

  function render() {
    switch (section) {
      case 'dashboard': return <Dashboard onOpenMember={openMember} onOpenSegment={openMembers} />
      case 'members': return <Members catalog={catalog} openId={openMemberId} onConsumedOpen={() => setOpenMemberId(null)} onLevelsChange={onLevelsChange} filter={membersFilter} onClearFilter={() => setMembersFilter('all')} />
      case 'leaders': return <Leaders catalog={catalog} onOpenMember={openMember} />
      case 'allowlist': return <Allowlist onOpenMember={openMember} />
      case 'efir': return <EfirRegistrations />
      case 'pairs': return <Pairs />
      case 'networking': return <NetworkingAdmin />
      case 'showcase': return <ShowcaseAdmin />
      case 'achievements': return <AchievementsAdmin only="money" onSaved={onCatalogChange} />
      case 'roles': return <AchievementsAdmin only="role" onSaved={onCatalogChange} />
      case 'notifications': return <Notifications />
      default: return <Stub title={LABELS[section] ?? 'Раздел'} />
    }
  }

  return (
    <div className="layout">
      <Sidebar current={section} onSelect={selectSection} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
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
