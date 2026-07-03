import './Header.css'

export default function Header({ title = 'APClub', onBack }: { title?: string; onBack?: () => void }) {
  return (
    <header className="app-header">
      <div className="hdr-left">
        <button className="hdr-btn" aria-label="Назад" onClick={onBack}>←</button>
        <span className="hdr-title">{title}</span>
      </div>
      <div className="hdr-right" />
    </header>
  )
}
