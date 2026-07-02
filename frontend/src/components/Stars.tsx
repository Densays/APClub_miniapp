import './Stars.css'

// Прогресс достижений в виде звёзд: `filled` золотых из `total`, остальные серые.
export default function Stars({
  filled,
  total = 16,
  size = 14,
}: {
  filled: number
  total?: number
  size?: number
}) {
  return (
    <span className="stars" style={{ fontSize: `${size}px` }} aria-label={`${filled} из ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`star${i < filled ? ' on' : ''}`}>★</span>
      ))}
    </span>
  )
}
