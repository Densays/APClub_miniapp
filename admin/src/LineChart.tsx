import type { TrendPoint } from './api'

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const monthLabel = (period: string) => {
  const m = Number(period.split('-')[1])
  return MONTHS[m - 1] ?? period
}

// Простой SVG-линейный график тренда по месяцам (0..yMax). preserveAspectRatio
// сохраняется — линии и точки не искажаются. Пропуски (null) не соединяются.
export default function LineChart({ data, color = 'var(--gold)', yMax = 100 }: {
  data: TrendPoint[]
  color?: string
  yMax?: number
}) {
  const W = 560, H = 170, padL = 34, padR = 12, padT = 12, padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const n = data.length
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1))
  const y = (v: number) => padT + (1 - Math.max(0, Math.min(yMax, v)) / yMax) * plotH

  const pts = data.map((d, i) => ({ i, v: d.value, cx: x(i), cy: d.value == null ? null : y(d.value) }))
  const defined = pts.filter((p) => p.cy != null) as { i: number; v: number; cx: number; cy: number }[]
  const linePath = defined.map((p, k) => `${k ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')
  const areaPath = defined.length
    ? `${linePath} L${defined[defined.length - 1].cx.toFixed(1)},${(padT + plotH).toFixed(1)} L${defined[0].cx.toFixed(1)},${(padT + plotH).toFixed(1)} Z`
    : ''
  const ticks = [0, yMax / 2, yMax]

  return (
    <svg className="lchart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--gray2)">{t}</text>
        </g>
      ))}
      {areaPath && <path d={areaPath} fill={color} opacity="0.12" />}
      {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      {defined.map((p) => (
        <g key={p.i}>
          <circle cx={p.cx} cy={p.cy} r="3.5" fill={color} />
          <text x={p.cx} y={p.cy - 8} textAnchor="middle" fontSize="10" fill={color} fontWeight="600">{p.v}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--gray2)">{monthLabel(d.period)}</text>
      ))}
    </svg>
  )
}
