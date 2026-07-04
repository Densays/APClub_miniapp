import './ResultBadge.css'

// Результат за месяц отдельной плашкой (лейбл + значение), чтобы не сливался
// со статусом и звёздами в общей ленте. Не рендерится, если значение пустое.
export default function ResultBadge({ value, label = 'за месяц' }: { value?: string; label?: string }) {
  if (!value) return null
  return (
    <div className="res-badge">
      <span className="res-badge-l">{label}</span>
      <b className="res-badge-v">{value}</b>
    </div>
  )
}
