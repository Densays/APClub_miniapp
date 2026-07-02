import { useEffect, useState } from 'react'
import './Countdown.css'

function diff(target: number) {
  const total = Math.max(0, target - Date.now())
  const days = Math.floor(total / 86400000)
  const hours = Math.floor((total % 86400000) / 3600000)
  const minutes = Math.floor((total % 3600000) / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  return { days, hours, minutes, seconds }
}

export default function Countdown({ to }: { to: string | number }) {
  const target = new Date(to).getTime()
  const [t, setT] = useState(() => diff(target))

  useEffect(() => {
    const id = setInterval(() => setT(diff(target)), 1000)
    return () => clearInterval(id)
  }, [target])

  const items = [
    { v: t.days, l: 'ДНЕЙ' },
    { v: t.hours, l: 'ЧАСОВ' },
    { v: t.minutes, l: 'МИНУТ' },
    { v: t.seconds, l: 'СЕКУНД' },
  ]

  return (
    <div className="countdown">
      <div className="cd-title">ДО ВСТРЕЧИ РЕЗИДЕНТОВ</div>
      <div className="cd-row">
        {items.map((it, i) => (
          <div key={it.l} className="cd-item-wrap">
            {i > 0 && <span className="cd-sep">:</span>}
            <div className="cd-item">
              <div className="cd-val">{String(it.v).padStart(2, '0')}</div>
              <div className="cd-lbl dim">{it.l}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
