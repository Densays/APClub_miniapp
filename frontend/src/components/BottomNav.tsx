import './BottomNav.css'

type Item = { id: string; label: string; icon: string }

const ITEMS: Item[] = [
  { id: 'home', label: 'Главная', icon: '🏠' },
  { id: 'community', label: 'Сообщество', icon: '👥' },
  { id: 'favorites', label: 'Избранное', icon: '⭐' },
]

export default function BottomNav({
  active = 'home',
  onSelect,
}: {
  active?: string
  onSelect?: (id: string) => void
}) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map((it) => (
        <button
          key={it.id}
          className={`bn-item${active === it.id ? ' is-active' : ''}`}
          onClick={() => onSelect?.(it.id)}
        >
          <span className="bn-icon">{it.icon}</span>
          <span className="bn-label">{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
