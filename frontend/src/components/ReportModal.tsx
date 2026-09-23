import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import arbixLogo from '../assets/arbix-logo.webp'
import './ReportModal.css'

const JOURNAL_API = 'https://trade-journal-arbix.vercel.app'
const GREEN = '#34d399'
const RED = '#fb7185'

type Trade = {
  id: string
  ticker: string
  pnl: number
  pnlNoFees: number
  fee: number
  funding: number
  closedAt: string | null
  legA: { exchangeLabel: string; direction: string }
  legB: { exchangeLabel: string; direction: string }
}

function fmtMoney(n: number) {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Точно тот же ArbTwoLineChart из TradeJournal ──────────────────────────
function ArbTwoLineChart() {
  const W = 560; const H = 110;
  const pts: [number, number][] = [
    [0, 54], [160, 50], [280, 68], [480, 12], [560, 12],
  ]
  function halfSpread(x: number): number {
    if (x >= 480) return 0
    const t = x / 480
    const sine = 18 + 8 * Math.sin(t * Math.PI * 3.0)
    const envelope = Math.pow(1 - t, 0.6)
    return Math.max(1, sine * envelope)
  }
  function buildPath(offset: (x: number) => number): string {
    const p: [number, number][] = pts.map(([x, y]) => [x, y + offset(x)])
    let d = `M ${p[0]![0]} ${p[0]![1].toFixed(1)}`
    for (let i = 1; i < p.length; i++) {
      const p0 = p[i - 1]!; const p1 = p[i]!
      const mx = (p0[0] + p1[0]) / 2
      d += ` C ${mx} ${p0[1].toFixed(1)} ${mx} ${p1[1].toFixed(1)} ${p1[0]} ${p1[1].toFixed(1)}`
    }
    return d
  }
  const upperD = buildPath(x => -halfSpread(x))
  const lowerD = buildPath(x => +halfSpread(x))
  function buildReverse(): string {
    const p: [number, number][] = pts.map(([x, y]) => [x, y + halfSpread(x)])
    let d = `L ${p[p.length - 1]![0]} ${p[p.length - 1]![1].toFixed(1)}`
    for (let i = p.length - 2; i >= 0; i--) {
      const p0 = p[i]!; const p1 = p[i + 1]!
      const mx = (p0[0] + p1[0]) / 2
      d += ` C ${mx} ${p1[1].toFixed(1)} ${mx} ${p0[1].toFixed(1)} ${p0[0]} ${p0[1].toFixed(1)}`
    }
    return d
  }
  const areaD = upperD + buildReverse() + ' Z'
  const entryX = 80
  const entryBaseY = (pts[0]![1] + pts[1]![1]) / 2
  const entryHSavg = (halfSpread(pts[0]![0]) + halfSpread(pts[1]![0])) / 2
  const entryUY = (entryBaseY - entryHSavg).toFixed(1)
  const entryLY = (entryBaseY + entryHSavg).toFixed(1)
  const exitX = 480
  const exitY = pts[3]![1].toFixed(1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.04" />
        </linearGradient>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={areaD} fill="url(#sg2)" />
      <line x1={entryX} y1={10} x2={entryX} y2={H - 10} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3 4" />
      <line x1={exitX} y1={10} x2={exitX} y2={H - 10} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3 4" />
      <path d={lowerD} fill="none" stroke="#818cf8" strokeWidth={1.8} strokeLinecap="round" opacity={0.75} />
      <path d={upperD} fill="none" stroke="#2dd4bf" strokeWidth={2.2} strokeLinecap="round" filter="url(#glow2)" />
      <circle cx={entryX} cy={entryUY} r={4.5} fill="#0e0e12" stroke="#2dd4bf" strokeWidth={2} />
      <circle cx={entryX} cy={entryLY} r={3.5} fill="#0e0e12" stroke="#818cf8" strokeWidth={1.5} opacity={0.85} />
      <circle cx={exitX} cy={exitY} r={4.5} fill="#0e0e12" stroke="#2dd4bf" strokeWidth={2} />
      <circle cx={exitX} cy={exitY} r={3.5} fill="#0e0e12" stroke="#818cf8" strokeWidth={1.5} opacity={0.85} />
    </svg>
  )
}

// ── Точно та же ShareTradeCard из TradeJournal ────────────────────────────
function ShareTradeCard({ trade, userCode }: { trade: Trade; userCode: string }) {
  const { pnl, pnlNoFees, fee, funding, ticker, legA, legB, closedAt } = trade
  const isPos = pnl >= 0
  const PNL_COLOR = isPos ? GREEN : RED
  const now = closedAt ? new Date(closedAt) : new Date()
  const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')
  const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + ' UTC'

  return (
    <div style={{
      background: 'linear-gradient(160deg, #12141a 0%, #0d0f16 60%, #0a0c14 100%)',
      borderRadius: 16, overflow: 'hidden', color: '#fff',
      border: '1px solid rgba(255,255,255,0.08)',
      width: '100%', boxSizing: 'border-box' as const,
      aspectRatio: '16/9',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* TOP */}
      <div style={{ padding: '8px 14px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          {/* Логотип: треугольник + текст */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src={arbixLogo} alt="" style={{ height: 18, display: 'block' }} />
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', color: '#fff' }}>Arbix</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
            <div>{dateStr}</div><div>{timeStr}</div>
          </div>
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', marginBottom: 2 }}>ИТОГ СЕССИИ</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: PNL_COLOR, lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
          {pnl > 0 ? '+' : ''}{fmtMoney(pnl)} $
        </div>
        <div style={{ display: 'flex', gap: 16, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { label: 'СДЕЛКА', value: pnlNoFees },
            { label: 'ФАНДИНГ', value: funding },
            { label: 'КОМИССИЯ', value: -Math.abs(fee) },
          ].map((item, i) => (
            <div key={i}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.18em', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: item.value > 0 ? GREEN : item.value < 0 ? RED : 'rgba(255,255,255,0.5)' }}>
                {item.value > 0 ? '+' : ''}{fmtMoney(item.value)} $
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* CHART */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ArbTwoLineChart />
      </div>
      {/* BOTTOM */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{ticker}/USDT</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#2dd4bf' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2dd4bf', display: 'inline-block' }} />
            {legA.exchangeLabel.toUpperCase()}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#f97316' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
            {legB.exchangeLabel.toUpperCase()}
          </span>
        </div>
        <div style={{ background: 'rgba(30,35,50,0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 12px' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 1 }}>arbix.pro</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>КОД <span style={{ color: '#fff', fontWeight: 700 }}>{userCode}</span></div>
        </div>
      </div>
    </div>
  )
}

// ── Демо-данные ───────────────────────────────────────────────────────────
const DEMO_TRADES: Trade[] = [
  { id: '1', ticker: 'BTC', pnl: 23.90, pnlNoFees: 40.71, fee: 13.52, funding: -3.30,
    closedAt: new Date().toISOString(),
    legA: { exchangeLabel: 'Binance', direction: 'LONG' }, legB: { exchangeLabel: 'Bybit', direction: 'SHORT' } },
  { id: '2', ticker: 'ETH', pnl: 11.40, pnlNoFees: 18.20, fee: 5.10, funding: -1.70,
    closedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    legA: { exchangeLabel: 'OKX', direction: 'LONG' }, legB: { exchangeLabel: 'Gate', direction: 'SHORT' } },
  { id: '3', ticker: 'SOL', pnl: 8.75, pnlNoFees: 12.40, fee: 2.90, funding: -0.75,
    closedAt: new Date(Date.now() - 3600000 * 7).toISOString(),
    legA: { exchangeLabel: 'Bybit', direction: 'LONG' }, legB: { exchangeLabel: 'KuCoin', direction: 'SHORT' } },
]

// ── Модальное окно ────────────────────────────────────────────────────────
export default function ReportModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [trades, setTrades] = useState<Trade[]>(DEMO_TRADES)
  const [selected, setSelected] = useState<Trade>(DEMO_TRADES[0]!)
  const [sending, setSending] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${JOURNAL_API}/api/miniapp/trades`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((data: Trade[] | null) => {
        if (data && data.length > 0) { setTrades(data); setSelected(data[0]!) }
      })
      .catch(() => {})
  }, [])

  const handleSend = async () => {
    setSending(true)
    try {
      // Рендерим карточку в PNG
      const node = cardRef.current
      if (!node) return

      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: 'transparent',
        width: node.offsetWidth,
        height: node.offsetHeight,
      })

      // Копируем PNG в буфер обмена
      try {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
      } catch {
        // Fallback если clipboard API не поддерживается
      }

      // Открываем топик «Отчёты»
      const tg = (window as any).Telegram?.WebApp
      if (tg?.openTelegramLink) {
        tg.openTelegramLink('https://t.me/c/2437297030/2')
      }
    } catch (e) { console.error(e) }
    setSending(false)
    onSent()
  }

  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
  const userCode = tgUser
    ? (tgUser.username ?? String(tgUser.id)).replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()
    : 'ARBIX'

  return (
    <div className="rm-backdrop" onClick={onClose}>
      <div className="rm-sheet" onClick={e => e.stopPropagation()}>
        <div className="rm-title">Отчёт за день</div>

        {/* Карточка — точная копия ShareTradeCard */}
        <div ref={cardRef} style={{ display: 'block', width: '100%' }}>
          <ShareTradeCard trade={selected} userCode={userCode} />
        </div>

        {/* Выбор сделки */}
        {trades.length > 1 && (
          <div className="rm-picker">
            <div className="rm-picker-label">Другая сделка:</div>
            <div className="rm-picker-list">
              {trades.map(t => (
                <button key={t.id} className={`rm-pick-btn${selected.id === t.id ? ' active' : ''}`} onClick={() => setSelected(t)}>
                  <span>{t.ticker}/USDT · {t.legA.exchangeLabel}↔{t.legB.exchangeLabel}</span>
                  <span style={{ color: t.pnl >= 0 ? GREEN : RED, fontWeight: 700 }}>
                    {t.pnl >= 0 ? '+' : ''}{fmtMoney(t.pnl)} $
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="rm-send-btn" onClick={handleSend} disabled={sending}>
          {sending ? '✓ Скопировано — вставьте в Telegram' : '📋 Скопировать и открыть чат'}
        </button>
      </div>
    </div>
  )
}
