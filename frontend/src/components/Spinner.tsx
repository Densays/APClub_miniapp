import './Spinner.css'

// Золотой круговой спиннер в стиле клуба.
// full=true — по центру всего экрана (для загрузки при открытии приложения).
export default function Spinner({ full = false, size = 44 }: { full?: boolean; size?: number }) {
  const ring = (
    <span
      className="spinner"
      style={{ width: size, height: size, borderWidth: Math.max(3, Math.round(size / 12)) }}
      role="status"
      aria-label="Загрузка"
    />
  )
  return full ? <div className="spinner-full">{ring}</div> : <div className="spinner-wrap">{ring}</div>
}
