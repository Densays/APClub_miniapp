import { useEffect, useRef, useState } from 'react'
import './ArbixStats.css'
import ReportModal from './ReportModal'

const JOURNAL_API = 'https://trade-journal-arbix.vercel.app'
const GOLD = '#d9b974'
const RED = '#fb7185'

type GrowthPoint = { date: string; value: number }
type Stats = {
  totalPnl: number
  winRate: number
  wins: number
  total: number
  growth: GrowthPoint[]
}

const DEMO: Stats = {
  totalPnl: 318.30,
  winRate: 90,
  wins: 54,
  total: 60,
  growth: [
    { date: '2026-08-19', value: 11.2 },
    { date: '2026-08-22', value: 34.0 },
    { date: '2026-08-25', value: 52.1 },
    { date: '2026-08-28', value: 82.1 },
    { date: '2026-09-02', value: 96.0 },
    { date: '2026-09-05', value: 133.5 },
    { date: '2026-09-09', value: 160.7 },
    { date: '2026-09-13', value: 209.2 },
    { date: '2026-09-18', value: 251.7 },
    { date: '2026-09-22', value: 318.3 },
  ],
}

const MONTH_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

function niceStep(raw: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const normalized = raw / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

// ── Точно тот же WinRateGauge что в дашборде ──────────────────────────────
function WinRateGauge({ wins, total }: { wins: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((wins / total) * 100)
  const size = 220; const cx = size / 2; const cy = size / 2 + 6; const r = 78
  const tickR = r + 14; const labelR = r + 26

  const arcPoint = (a: number, radius = r) => ({ x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) })
  const start = arcPoint(Math.PI); const top = arcPoint(Math.PI / 2); const end = arcPoint(0)
  const fullArc = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${top.x} ${top.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`

  const majorTicks = [0, 20, 40, 60, 80, 100]
  const minorTicks: number[] = []
  for (let t = 5; t < 100; t += 5) if (t % 20 !== 0) minorTicks.push(t)

  const pctY = cy + 46; const subtitleY = pctY + 24; const needleLen = r - 20
  const needleRef = useRef<SVGGElement>(null)
  const pctTextRef = useRef<SVGTextElement>(null)

  useEffect(() => {
    const applyPct = (p: number) => {
      const deg = 1.8 * p - 180
      if (needleRef.current) needleRef.current.style.transform = `rotate(${deg}deg)`
      if (pctTextRef.current) pctTextRef.current.textContent = `${Math.round(p)}%`
    }
    const DURATION = 1100; const t0 = performance.now(); let raf = 0
    function frame(now: number) {
      const t = Math.min(1, (now - t0) / DURATION)
      applyPct(pct * easeOutCubic(t))
      if (t < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [pct])

  return (
    <svg viewBox={`0 0 ${size} ${subtitleY + 12}`} width="100%" height="100%" role="img" aria-label="Win Rate">
      <defs>
        <linearGradient id="wr-arc-club" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#fb7185" />
          <stop offset="34%"  stopColor="#fb923c" />
          <stop offset="67%"  stopColor="#facc15" />
          <stop offset="100%" stopColor="#4ade80" />
        </linearGradient>
      </defs>
      <path d={fullArc} fill="none" stroke="url(#wr-arc-club)" strokeWidth={12} strokeLinecap="round" />
      {minorTicks.map(t => {
        const a = Math.PI - (t / 100) * Math.PI
        const p1 = arcPoint(a, tickR - 3); const p2 = arcPoint(a, tickR)
        return <line key={t} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      })}
      {majorTicks.map(t => {
        const a = Math.PI - (t / 100) * Math.PI
        const p1 = arcPoint(a, tickR - 6); const p2 = arcPoint(a, tickR)
        const label = arcPoint(a, labelR)
        return (
          <g key={t}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
            {t !== 0 && t !== 100 && (
              <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.35)">{t}</text>
            )}
          </g>
        )
      })}
      <g ref={needleRef} style={{ transform: 'rotate(-180deg)', transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cx} y1={cy} x2={cx + needleLen} y2={cy} stroke={GOLD} strokeWidth={3} strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r={6} fill={GOLD} />
      <text ref={pctTextRef} x={cx} y={pctY} textAnchor="middle" fontSize={24} fontWeight={700} fill={GOLD} fontFamily="Unbounded, sans-serif">0%</text>
      <text x={cx} y={subtitleY} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.4)">{total} сделок</text>
    </svg>
  )
}

// ── Точно тот же CumulativeGrowthChart что в дашборде ─────────────────────
function GrowthChart({ data }: { data: GrowthPoint[] }) {
  const pathRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [hoverT, setHoverT] = useState<number | null>(null)

  useEffect(() => {
    if (!pathRef.current) return
    setPathLength(pathRef.current.getTotalLength())
    setRevealed(false)
    const r1 = requestAnimationFrame(() => { const r2 = requestAnimationFrame(() => setRevealed(true)); return r2 })
    return () => cancelAnimationFrame(r1)
  }, [data])

  if (data.length === 0) return null

  const W = 640; const H = 200; const padR = 20; const padT = 12; const padB = 32
  const values = data.map(d => d.value)
  const dataMin = Math.min(0, ...values); const dataMax = Math.max(0, ...values)
  const step = niceStep((dataMax - dataMin) / 3 || 1)
  const axisMax = Math.max(step, Math.ceil(dataMax / step) * step)
  const axisMin = Math.min(0, Math.floor(dataMin / step) * step)
  const range = axisMax - axisMin || 1

  const ticks: number[] = []
  for (let v = axisMin; v <= axisMax + 0.001; v += step) ticks.push(Math.round(v * 100) / 100)
  const tickLabels = ticks.map(t => t.toLocaleString('ru-RU', { maximumFractionDigits: 0 }))
  const padL = 14 + Math.max(...tickLabels.map(s => s.length)) * 7

  const plotW = W - padL - padR; const plotH = H - padT - padB
  const timestamps = data.map(d => new Date(d.date).getTime())
  const tMin = timestamps[0] ?? 0; const tRange = (timestamps[timestamps.length - 1] ?? 1) - tMin || 1

  const xOf = (i: number) => padL + ((timestamps[i]! - tMin) / tRange) * plotW
  const yOf = (v: number) => padT + plotH - ((v - axisMin) / range) * plotH
  const points = data.map((d, i) => ({ x: xOf(i), y: yOf(d.value), ...d }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const baselineY = padT + plotH
  const last = points[points.length - 1]!
  const areaPath = `${path} L${last.x.toFixed(1)},${baselineY} L${points[0]!.x.toFixed(1)},${baselineY} Z`

  const xLabels: { x: number; label: string }[] = []
  let lastM = -1
  for (let i = 0; i < data.length; i++) {
    const d = new Date(data[i]!.date); const m = d.getMonth()
    if (m !== lastM) { xLabels.push({ x: points[i]!.x, label: `${MONTH_SHORT[m]} ${String(d.getFullYear()).slice(2)}` }); lastM = m }
  }
  const filteredX = xLabels.filter((l, i) => i === 0 || l.x - xLabels[i - 1]!.x >= 48)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ flex: 1, minHeight: 0 }}>
        <defs>
          <linearGradient id="gf-club" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => {
          const y = yOf(t)
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.3)">{tickLabels[i]}</text>
            </g>
          )
        })}
        <line x1={padL} y1={padT} x2={padL} y2={baselineY} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        <path d={areaPath} fill="url(#gf-club)" stroke="none" style={{ opacity: revealed ? 1 : 0, transition: 'opacity 900ms ease-out 250ms' }} />
        <path ref={pathRef} d={path} fill="none" stroke={GOLD} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          style={pathLength ? {
            strokeDasharray: pathLength,
            strokeDashoffset: revealed ? 0 : pathLength,
            transition: 'stroke-dashoffset 1300ms ease-out',
          } : undefined}
        />
        <circle cx={last.x} cy={last.y} r={3.5} fill={GOLD} style={{ opacity: revealed ? 1 : 0, transition: 'opacity 300ms ease-out 1050ms' }} />

        {/* Hover */}
        <rect x={padL - 4} y={padT - 4} width={plotW + 8} height={plotH + 8} fill="transparent" pointerEvents="all" style={{ cursor: 'crosshair' }}
          onMouseMove={e => {
            const svg = e.currentTarget.ownerSVGElement; const ctm = svg?.getScreenCTM()
            if (!svg || !ctm) return
            const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
            const mx = pt.matrixTransform(ctm.inverse()).x
            let best = 0; let bestD = Math.abs(points[0]!.x - mx)
            for (let i = 1; i < points.length; i++) { const d = Math.abs(points[i]!.x - mx); if (d < bestD) { bestD = d; best = i } }
            const i0 = mx < points[best]!.x && best > 0 ? best - 1 : best
            const i1 = Math.min(points.length - 1, i0 + 1)
            const x0 = points[i0]!.x; const x1 = points[i1]!.x
            setHoverT(i0 + (x1 !== x0 ? Math.max(0, Math.min(1, (mx - x0) / (x1 - x0))) : 0))
          }}
          onMouseLeave={() => setHoverT(null)}
          onTouchMove={e => {
            const t = e.touches[0]; if (!t) return
            const svg = e.currentTarget.ownerSVGElement; const ctm = svg?.getScreenCTM()
            if (!svg || !ctm) return
            const pt = svg.createSVGPoint(); pt.x = t.clientX; pt.y = t.clientY
            const mx = pt.matrixTransform(ctm.inverse()).x
            let best = 0; let bestD = Math.abs(points[0]!.x - mx)
            for (let i = 1; i < points.length; i++) { const d = Math.abs(points[i]!.x - mx); if (d < bestD) { bestD = d; best = i } }
            setHoverT(best)
          }}
          onTouchEnd={() => setHoverT(null)}
        />

        {hoverT != null && (() => {
          const i0 = Math.floor(hoverT); const i1 = Math.min(data.length - 1, i0 + 1)
          const frac = hoverT - i0
          const hx = points[i0]!.x + (points[i1]!.x - points[i0]!.x) * frac
          const hy = points[i0]!.y + (points[i1]!.y - points[i0]!.y) * frac
          const ni = Math.max(0, Math.min(data.length - 1, Math.round(hoverT)))
          const p = points[ni]!
          const delta = p.value - (ni > 0 ? points[ni - 1]!.value : 0)
          const d = new Date(p.date)
          const dateLabel = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
          const bW = 160; const bH = 54
          const flip = hx + 10 + bW > W - padR
          const bX = flip ? hx - 10 - bW : hx + 10
          const bY = Math.max(padT, Math.min(hy - bH / 2, H - padB - bH))
          return (
            <g pointerEvents="none">
              <line x1={hx} y1={padT} x2={hx} y2={baselineY} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={hx} cy={hy} r={4.5} fill="#fff" stroke={GOLD} strokeWidth={2} />
              <rect x={bX} y={bY} width={bW} height={bH} rx={8} fill="#1a1a1d" stroke="rgba(217,185,116,0.3)" />
              <text x={bX + 10} y={bY + 18} fontSize={10} fill="rgba(255,255,255,0.45)">{dateLabel}</text>
              <text x={bX + 10} y={bY + 40} fontSize={13} fontWeight={700} fill={delta >= 0 ? GOLD : RED}>
                {delta >= 0 ? '+' : ''}{delta.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} $
              </text>
              <text x={bX + bW - 10} y={bY + 40} textAnchor="end" fontSize={12} fontWeight={700} fill="rgba(255,255,255,0.8)">
                {p.value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} $
              </text>
            </g>
          )
        })()}

        {filteredX.map(l => (
          <text key={l.label + l.x} x={l.x} y={H - 6} fontSize={10} fill="rgba(255,255,255,0.3)" textAnchor="middle">{l.label}</text>
        ))}
      </svg>
    </div>
  )
}

// ── Основной компонент ─────────────────────────────────────────────────────
export default function ArbixStats() {
  const [stats, setStats] = useState<Stats>(DEMO)
  const [sent, setSent] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const initData = (window as any).Telegram?.WebApp?.initData ?? ''
    const headers: Record<string, string> = {}
    if (initData) headers['x-telegram-init-data'] = initData
    fetch(`${JOURNAL_API}/api/miniapp/stats`, { credentials: 'include', headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data) })
      .catch(() => {})
  }, [])

  const isPos = stats.totalPnl >= 0
  const pnlColor = isPos ? '#d9b974' : '#fb7185'
  const pnlStr = `${isPos ? '+' : ''}${stats.totalPnl.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
  // Цель на месяц — пока демо, потом из профиля
  const monthGoal = 500
  const goalStr = `${monthGoal.toLocaleString('ru-RU')} $`
  const goalPct = monthGoal > 0 ? (stats.totalPnl / monthGoal) * 100 : 0

  return (
    <>
    <div className="arbix-stats card">
      <div className="arbix-stats-header">
        <span className="arbix-stats-title">Arbix Journal</span>
        <span className="arbix-stats-badge">Арбитраж</span>
      </div>

      {/* Левый: график | Правый: winrate */}
      <div className="arbix-stats-main">
        <div className="arbix-stats-chart">
          <GrowthChart data={stats.growth} />
        </div>
        <div className="arbix-stats-gauge">
          <WinRateGauge wins={stats.wins} total={stats.total} />
        </div>
      </div>

      {/* Прирост слева, цель справа */}
      <div className="arbix-stats-pnl">
        <div className="arbix-stats-pnl-left">
          <div className="arbix-stats-pnl-label">ПРИРОСТ КАПИТАЛА</div>
          <div className="arbix-stats-pnl-value" style={{ color: pnlColor }}>{pnlStr}</div>
        </div>
        <div className="arbix-stats-pnl-right">
          <div className="arbix-stats-pnl-label">ЦЕЛЬ НА МЕСЯЦ</div>
          <div className="arbix-stats-pnl-value" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }}>
            {goalStr}
          </div>
        </div>
      </div>

      {/* Прогресс-бар под ними */}
      <div>
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: goalPct >= 100 ? '#4ade80' : GOLD,
            width: `${Math.min(100, goalPct)}%`,
            transition: 'width 1s ease-out',
          }} />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
          {Math.round(goalPct)}% от цели
        </div>
      </div>

      <div className="arbix-stats-report">
        <div className="arbix-stats-report-label">Отчёт за день<br/>в Telegram</div>
        <button className={`arbix-stats-btn${sent ? ' sent' : ''}`} onClick={() => setShowModal(true)} disabled={sent}>
          {sent ? '✓ Отправлено' : '📤 Отправить'}
        </button>
      </div>
    </div>

    {showModal && (
      <ReportModal
        onClose={() => setShowModal(false)}
        onSent={() => { setSent(true); setTimeout(() => setSent(false), 3000) }}
      />
    )}
    </>
  )
}
