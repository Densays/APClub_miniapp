import Icon from './Icon'

// Пункт меню. active=false → раздел-заготовка (наполним позже).
export type NavItem = { key: string; label: string; icon: string; active?: boolean }
export type NavGroup = { title?: string; items: NavItem[] }

// Оставлены только нужные разделы. Рабочие: Участники, Таблица лидеров, Витрина.
// Заготовки (наполняются по мере необходимости): Материалы, Платежи, Рассылки.
export const NAV: NavGroup[] = [
  { items: [
    { key: 'dashboard', label: 'Дашборд', icon: 'dashboard', active: true },
  ] },
  { title: 'Пользователи', items: [
    { key: 'members', label: 'Участники', icon: 'users', active: true },
    { key: 'leaders', label: 'Таблица лидеров', icon: 'leaders', active: true },
    { key: 'allowlist', label: 'Доступ по почте', icon: 'lock', active: true },
  ] },
  { title: 'Геймификация', items: [
    { key: 'achievements', label: 'Достижения', icon: 'tasks', active: true },
    { key: 'roles', label: 'Роли', icon: 'users', active: true },
    { key: 'showcase', label: 'Витрина клуба', icon: 'gift', active: true },
    { key: 'pairs', label: 'Бадди', icon: 'referrals', active: true },
    { key: 'networking', label: 'Нетворкинг', icon: 'users', active: true },
  ] },
  { title: 'Контент', items: [
    { key: 'materials', label: 'Материалы', icon: 'materials' },
  ] },
  { title: 'Подписки', items: [
    { key: 'payments', label: 'Платежи', icon: 'payments' },
  ] },
  { title: 'Коммуникации', items: [
    { key: 'notifications', label: 'Уведомления', icon: 'bell', active: true },
    { key: 'mailings', label: 'Рассылки', icon: 'mail' },
  ] },
]

export default function Sidebar({ current, onSelect, onLogout, theme, onToggleTheme }: {
  current: string
  onSelect: (key: string) => void
  onLogout: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}) {
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <span className="sb-logo">AP</span>
        <div className="sb-brand-txt">
          <div className="sb-brand-name">AP Club</div>
          <div className="sb-brand-sub">Админ панель</div>
        </div>
      </div>

      <nav className="sb-nav">
        {NAV.map((g, gi) => (
          <div className="sb-group" key={gi}>
            {g.title && <div className="sb-group-t">{g.title}</div>}
            {g.items.map((it) => (
              <button
                key={it.key}
                className={`sb-item${current === it.key ? ' active' : ''}`}
                onClick={() => onSelect(it.key)}
              >
                <span className="sb-item-i"><Icon name={it.icon} /></span>
                <span className="sb-item-l">{it.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sb-footer">
        <button className="sb-theme" onClick={onToggleTheme} title="Сменить тему">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          <span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
        </button>
        <button className="sb-logout" onClick={onLogout}>Выйти</button>
      </div>
    </aside>
  )
}
