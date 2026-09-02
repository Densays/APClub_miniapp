import { useEffect, useRef, useState } from 'react'
import { TgButton } from './TgButton'
import {
  getTjOverview, getTjUsers, getTjUserProfile, getTjConnections,
  deleteTjConnection, replaceTjConnectionCredentials,
  type TjOverview, type TjUser, type TjUserProfile, type TjConnection, type TjApclubMatch,
} from './api'

// Вкладка «Trade Journal» — витрина + пункт управления над соседним проектом
// (личный кабинет резидентов для учёта сделок/бирж/PnL). Данные и мутации
// идут через server/src/tradejournal.ts, который проксирует TradeJournal'овский
// /api/admin/* с отдельным серверным секретом и подмешивает профиль резидента
// APClub по e-mail (matchApclubProfile в index.ts). Ключи биржи здесь никогда
// не читаются — только запись новых (см. TradeJournal'овский
// replaceConnectionCredentials) и удаление подключения целиком.

const MODE_LABELS: Record<string, string> = { ARBITRAGE: 'Арбитраж', TRADING: 'Трейдинг' }
const fmtMoney = (n: number) => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCompact = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`
  if (abs >= 1_000) return `${(n / 1_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} тыс.`
  return fmtMoney(n)
}
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru-RU') : '—')
const pnlColor = (n: number) => (n < 0 ? 'var(--danger)' : 'var(--green)')
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

// Same half-circle gauge as the resident's own dashboard in TradeJournal
// (dashboard-widgets.tsx WinRateGauge) — arc, ticks, animated needle — ported
// here rather than shared across the two separate repos, redrawn with this
// app's own CSS vars. The red→orange→yellow→green stops are TradeJournal's
// fixed semantic scale (--status-critical/serious/warning/good), not a theme
// color, so they're hardcoded the same on both sides deliberately.
function WinRateGauge({ pct, subtitle }: { pct: number; subtitle: string }) {
  const size = 220
  const cx = size / 2
  const cy = size / 2 + 6
  const r = 78
  const tickR = r + 14
  const labelR = r + 26

  const arcPoint = (a: number, radius = r) => ({ x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) })
  const start = arcPoint(Math.PI)
  const top = arcPoint(Math.PI / 2)
  const end = arcPoint(0)
  const fullArc = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${top.x} ${top.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`

  const majorTicks = [0, 20, 40, 60, 80, 100]
  const minorTicks: number[] = []
  for (let t = 5; t < 100; t += 5) if (t % 20 !== 0) minorTicks.push(t)

  const pctY = cy + 46
  const subtitleY = pctY + 24
  const needleLen = r - 20

  const needleRef = useRef<SVGGElement>(null)
  const pctTextRef = useRef<SVGTextElement>(null)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const applyPct = (p: number) => {
      const needleAngleDeg = 1.8 * p - 180
      if (needleRef.current) needleRef.current.style.transform = `rotate(${needleAngleDeg}deg)`
      if (pctTextRef.current) pctTextRef.current.textContent = `${Math.round(p)}%`
    }
    if (reduced) { applyPct(pct); return }
    const DURATION = 1100
    const t0 = performance.now()
    let raf = 0
    function frame(now: number) {
      const t = Math.min(1, (now - t0) / DURATION)
      applyPct(pct * easeOutCubic(t))
      if (t < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [pct])

  return (
    <svg viewBox={`0 0 ${size} ${subtitleY + 12}`} width="100%" height="100%" role="img" aria-label="Win-rate">
      <defs>
        <linearGradient id="tj-winrate-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d03b3b" />
          <stop offset="34%" stopColor="#ec835a" />
          <stop offset="67%" stopColor="#fab219" />
          <stop offset="100%" stopColor="#0ca30c" />
        </linearGradient>
      </defs>

      <path d={fullArc} fill="none" stroke="url(#tj-winrate-arc)" strokeWidth={12} strokeLinecap="round" />
      {minorTicks.map((t) => {
        const angle = Math.PI - (t / 100) * Math.PI
        const p1 = arcPoint(angle, tickR - 3)
        const p2 = arcPoint(angle, tickR)
        return <line key={t} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--line2)" strokeWidth={1} />
      })}
      {majorTicks.map((t) => {
        const angle = Math.PI - (t / 100) * Math.PI
        const p1 = arcPoint(angle, tickR - 6)
        const p2 = arcPoint(angle, tickR)
        const label = arcPoint(angle, labelR)
        return (
          <g key={t}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--gray)" strokeWidth={1.5} />
            {t !== 0 && t !== 100 && (
              <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize={10} fill="var(--gray)">{t}</text>
            )}
          </g>
        )
      })}

      <g ref={needleRef} style={{ transform: 'rotate(-180deg)', transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cx} y1={cy} x2={cx + needleLen} y2={cy} stroke="var(--text)" strokeWidth={3} strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r={6} fill="var(--text)" />

      <text ref={pctTextRef} x={cx} y={pctY} textAnchor="middle" fontSize={24} fontWeight={700} fill="var(--text)">0%</text>
      <text x={cx} y={subtitleY} textAnchor="middle" fontSize={11} fill="var(--gray)">{subtitle}</text>
    </svg>
  )
}

const CRED_FIELDS: Record<string, { key: string; label: string; password?: boolean }[]> = {
  key_secret: [
    { key: 'apiKey', label: 'API-ключ' },
    { key: 'apiSecret', label: 'API-секрет', password: true },
  ],
  key_secret_passphrase: [
    { key: 'apiKey', label: 'API-ключ' },
    { key: 'apiSecret', label: 'API-секрет', password: true },
    { key: 'passphrase', label: 'Парольная фраза', password: true },
  ],
  wallet_agent_key: [
    { key: 'walletAddress', label: 'Адрес кошелька' },
    { key: 'agentPrivateKey', label: 'Приватный ключ агента', password: true },
  ],
  address_only: [{ key: 'walletAddress', label: 'Адрес кошелька' }],
  readonly_token: [
    { key: 'readOnlyToken', label: 'Read-only токен' },
    { key: 'apiSecret', label: 'API-секрет (необязательно)', password: true },
  ],
}

type Tab = 'overview' | 'users' | 'connections'

export default function TradeJournal() {
  const [tab, setTab] = useState<Tab>('overview')
  const [openUserId, setOpenUserId] = useState<string | null>(null)

  const openUser = (id: string) => { setOpenUserId(id); setTab('users') }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Trade Journal</h1>
          <div className="page-sub">Личные кабинеты резидентов в Trade Journal — биржи, сделки, PnL</div>
        </div>
      </div>

      <div className="tj-tabs">
        {([
          ['overview', 'Обзор'],
          ['users', 'Резиденты'],
          ['connections', 'Подключения бирж'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`tj-tab${tab === key ? ' active' : ''}`}
            onClick={() => { setTab(key); setOpenUserId(null) }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewView />}
      {tab === 'users' && (
        openUserId
          ? <UserDetailView id={openUserId} onBack={() => setOpenUserId(null)} />
          : <UsersView onOpen={openUser} />
      )}
      {tab === 'connections' && <ConnectionsView />}
    </div>
  )
}

function ErrorBanner({ err }: { err: string }) {
  return <div className="err">{err === 'unauth' ? 'Сессия истекла' : err}</div>
}

// ── Контакт резидента: почта всегда видна (для сверки) + Telegram, если
// e-mail совпал с профилем APClub ─────────────────────────────────────────
function ResidentContact({ email, apclub }: { email: string; apclub: TjApclubMatch }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={email}>{email}</span>
      {apclub && <TgButton p={{ username: apclub.username, userId: apclub.userId, social: apclub.social }} />}
    </span>
  )
}

function ProfileButton({ apclub }: { apclub: TjApclubMatch }) {
  const [open, setOpen] = useState(false)
  if (!apclub) return <span className="hint">Резидент не найден в APClub — почта не совпала ни с одним профилем</span>
  return (
    <>
      <button className="btn btn-ghost sm" onClick={(e) => { e.stopPropagation(); setOpen(true) }}>Профиль</button>
      {open && <ProfileModal apclub={apclub} onClose={() => setOpen(false)} />}
    </>
  )
}

// Открывается поверх страницы, НЕ переходя в раздел «Участники» — только
// пояснение, кто этот человек, чтобы свериться, не теряя контекст Trade Journal.
function ProfileModal({ apclub, onClose }: { apclub: NonNullable<TjApclubMatch>; onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-hero">
          <span className="avatar" style={{ width: 52, height: 52, fontSize: 18 }}>
            {apclub.avatar ? <img src={apclub.avatar} alt="" /> : (apclub.name[0] ?? '?')}
          </span>
          <div>
            <div className="modal-t">{apclub.name}</div>
            {apclub.city && <div className="hint">📍 {apclub.city}</div>}
          </div>
        </div>
        {apclub.occupation && (
          <div><div className="kpi-label" style={{ marginBottom: 4 }}>Деятельность</div><div>{apclub.occupation}</div></div>
        )}
        {apclub.focus && (
          <div><div className="kpi-label" style={{ marginBottom: 4 }}>Текущий фокус</div><div>{apclub.focus}</div></div>
        )}
        {apclub.about && (
          <div><div className="kpi-label" style={{ marginBottom: 4 }}>О себе</div><div>{apclub.about}</div></div>
        )}
        <div className="modal-actions">
          <TgButton p={{ username: apclub.username, userId: apclub.userId, social: apclub.social }} label />
          <button className="btn btn-ghost" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

function EditCredentialsModal({ connectionId, credentialKind, label, onClose, onSaved }: {
  connectionId: string; credentialKind: string; label: string; onClose: () => void; onSaved: () => void
}) {
  const fields = CRED_FIELDS[credentialKind] ?? CRED_FIELDS.key_secret
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setBusy(true); setErr('')
    try { await replaceTjConnectionCredentials(connectionId, values); onSaved(); onClose() }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-t">Сменить ключ — {label}</div>
        <div className="hint">Старый ключ нигде не показывается и не читается — впишите новый целиком.</div>
        {fields.map((f) => (
          <div className="field" key={f.key}>
            <label>{f.label}</label>
            <input
              className="input"
              type={f.password ? 'password' : 'text'}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              autoComplete="off"
            />
          </div>
        ))}
        {err && <div className="err">{err}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-gold" disabled={busy} onClick={submit}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Одна управляемая строка подключения — переиспользуется в Обзоре,
// «Подключения бирж» и внутри карточки резидента ──────────────────────────
type ManagedRow = {
  id: string
  exchange: string
  credentialKind: string
  label: string
  lastSyncedAt: string | null
  lastSyncError: string | null
  resident?: { email: string; apclub: TjApclubMatch }
}

function ManagedConnectionRow({ row, onChanged }: { row: ManagedRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function disconnect() {
    setBusy(true); setErr('')
    try { await deleteTjConnection(row.id); onChanged() }
    catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <div className={`tj-row${row.resident ? ' tj-row-conn-full' : ' tj-row-conn'}`}>
      {row.resident && <ResidentContact email={row.resident.email} apclub={row.resident.apclub} />}
      <span>{row.exchange}</span>
      <span>{row.label}</span>
      <span>{fmtDate(row.lastSyncedAt)}</span>
      <span style={{ color: row.lastSyncError ? 'var(--danger)' : row.lastSyncedAt ? 'var(--green)' : 'var(--gray)' }} title={row.lastSyncError ?? undefined}>
        {row.lastSyncError ? 'ошибка' : row.lastSyncedAt ? 'ок' : 'не синхронизировано'}
      </span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {!confirmDel ? (
          <>
            <button className="btn btn-ghost sm" onClick={() => setEditing(true)}>Сменить ключ</button>
            <button className="btn btn-danger sm" onClick={() => setConfirmDel(true)}>Отключить</button>
          </>
        ) : (
          <>
            <span className="confirm">Точно?</span>
            <button className="btn btn-danger sm" disabled={busy} onClick={disconnect}>{busy ? '…' : 'Да'}</button>
            <button className="btn btn-ghost sm" onClick={() => setConfirmDel(false)}>Отмена</button>
          </>
        )}
      </span>
      {err && <span className="err" style={{ gridColumn: '1 / -1' }}>{err}</span>}
      {editing && (
        <EditCredentialsModal
          connectionId={row.id}
          credentialKind={row.credentialKind}
          label={row.label}
          onClose={() => setEditing(false)}
          onSaved={onChanged}
        />
      )}
    </div>
  )
}

function ConnectionsTable({ rows, onChanged, showResident }: { rows: ManagedRow[]; onChanged: () => void; showResident: boolean }) {
  if (rows.length === 0) return <div className="hint">Подключений пока нет.</div>
  return (
    <div className="tj-table">
      <div className={`tj-row${showResident ? ' tj-row-conn-full' : ' tj-row-conn'} th`}>
        {showResident && <span>Резидент</span>}
        <span>Биржа</span><span>Название</span><span>Последний синк</span><span>Статус</span><span>Управление</span>
      </div>
      {rows.map((row) => <ManagedConnectionRow key={row.id} row={row} onChanged={onChanged} />)}
    </div>
  )
}

function OverviewView() {
  const [data, setData] = useState<TjOverview | null>(null)
  const [connections, setConnections] = useState<TjConnection[] | null>(null)
  const [err, setErr] = useState('')

  function load() {
    getTjOverview().then(setData).catch((e) => setErr((e as Error).message))
    getTjConnections().then(setConnections).catch(() => {})
  }
  useEffect(load, [])

  if (err) return <ErrorBanner err={err} />
  if (!data) return <div className="td-empty">Загрузка…</div>

  const KPIS: { label: string; value: string; title?: string; color?: string }[] = [
    { label: 'Резидентов ведут Trade Journal', value: String(data.userCount) },
    { label: 'Подключено бирж всего', value: String(data.connectionsByExchange.reduce((s, r) => s + r.count, 0)) },
    { label: 'Суммарные депозиты', value: `${fmtCompact(data.depositTotal)} $`, title: `${fmtMoney(data.depositTotal)} $` },
    { label: 'Закрытых сделок всего', value: String(data.closedTradeCount) },
  ]

  return (
    <>
      <div className="tj-hero-row">
        <div className="kpi-grid tj-hero-kpis">
          {KPIS.map((k) => (
            <div className="kpi" key={k.label}>
              <div className="kpi-top"><span className="kpi-label">{k.label}</span></div>
              <div className="kpi-value" title={k.title} style={k.color ? { color: k.color } : undefined}>{k.value}</div>
            </div>
          ))}
        </div>
        <div className="kpi tj-gauge-card">
          <div className="kpi-top"><span className="kpi-label">Средний win-rate резидентов</span></div>
          <WinRateGauge
            pct={data.avgResidentWinRate ?? 0}
            subtitle={`${data.residentsWithTradesCount} ${data.residentsWithTradesCount === 1 ? 'резидент' : 'резидентов'}`}
          />
        </div>
      </div>
      <div className="kpi kpi-wide">
        <div className="kpi-top"><span className="kpi-label">Суммарный PnL</span></div>
        <div className="kpi-value" title={`${data.pnl > 0 ? '+' : ''}${fmtMoney(data.pnl)} $`} style={{ color: pnlColor(data.pnl) }}>
          {data.pnl > 0 ? '+' : ''}{fmtCompact(data.pnl)} $
        </div>
      </div>

      <div className="card">
        <div className="card-t">Подключения бирж — управление</div>
        {connections == null ? (
          <div className="hint">Загрузка…</div>
        ) : (
          <ConnectionsTable
            rows={connections.map((c) => ({ ...c, resident: { email: c.userEmail, apclub: c.apclub } }))}
            onChanged={load}
            showResident
          />
        )}
      </div>
    </>
  )
}

function UsersView({ onOpen }: { onOpen: (id: string) => void }) {
  const [users, setUsers] = useState<TjUser[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    getTjUsers().then(setUsers).catch((e) => setErr((e as Error).message))
  }, [])

  if (err) return <ErrorBanner err={err} />
  if (!users) return <div className="td-empty">Загрузка…</div>
  if (users.length === 0) return <div className="td-empty">Резидентов пока нет.</div>

  return (
    <div className="tj-table">
      <div className="tj-row tj-row-users th">
        <span>Резидент</span><span>Почта</span><span>Режим</span><span>Бирж</span><span>Сделок</span><span>Win-rate</span>
      </div>
      {users.map((u) => (
        <button className="tj-row tj-row-users tj-row-btn" key={u.id} onClick={() => onOpen(u.id)}>
          <span>
            {u.apclub?.name || u.displayName || u.email}
            {u.isAdmin && <span className="gold" style={{ marginLeft: 6, fontSize: 11 }}>ADMIN</span>}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
          <span>{MODE_LABELS[u.journalMode] ?? u.journalMode}</span>
          <span>{u.exchangeConnectionCount}</span>
          <span>{u.closedTradeCount}</span>
          <span>{u.winRate == null ? '—' : `${u.winRate.toFixed(0)}%`}</span>
        </button>
      ))}
    </div>
  )
}

function UserDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [profile, setProfile] = useState<TjUserProfile | null>(null)
  const [err, setErr] = useState('')

  function load() {
    getTjUserProfile(id).then(setProfile).catch((e) => setErr((e as Error).message))
  }
  useEffect(() => { setProfile(null); load() }, [id])

  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom: 14 }} onClick={onBack}>← Все резиденты</button>
      {err && <ErrorBanner err={err} />}
      {!err && !profile && <div className="td-empty">Загрузка…</div>}
      {profile && (
        <>
          <div className="card-hero" style={{ marginBottom: 16 }}>
            {profile.apclub && (
              <span className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                {profile.apclub.avatar ? <img src={profile.apclub.avatar} alt="" /> : (profile.apclub.name[0] ?? '?')}
              </span>
            )}
            <div>
              <div className="card-t" style={{ marginBottom: 2 }}>{profile.apclub?.name || profile.displayName || profile.email}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <ResidentContact email={profile.email} apclub={profile.apclub} />
                <span className="hint">· {MODE_LABELS[profile.journalMode] ?? profile.journalMode}</span>
                <ProfileButton apclub={profile.apclub} />
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              {profile.apclub ? (
                <TgButton p={{ username: profile.apclub.username, userId: profile.apclub.userId, social: profile.apclub.social }} label />
              ) : (
                <span className="hint">Написать в Telegram нельзя — резидент не найден в APClub</span>
              )}
            </div>
          </div>

          <div className="tj-hero-row">
            <div className="kpi-grid tj-hero-kpis">
              <div className="kpi">
                <div className="kpi-top"><span className="kpi-label">Депозиты</span></div>
                <div className="kpi-value">{fmtMoney(profile.depositTotal)} $</div>
              </div>
              <div className="kpi">
                <div className="kpi-top"><span className="kpi-label">Закрытых сделок</span></div>
                <div className="kpi-value">{profile.closedTradeCount}</div>
              </div>
            </div>
            <div className="kpi tj-gauge-card">
              <div className="kpi-top"><span className="kpi-label">Win-rate</span></div>
              <WinRateGauge pct={profile.winRate ?? 0} subtitle={`${profile.closedTradeCount} сделок`} />
            </div>
          </div>
          <div className="kpi kpi-wide">
            <div className="kpi-top"><span className="kpi-label">Суммарный PnL</span></div>
            <div className="kpi-value" title={`${profile.pnl > 0 ? '+' : ''}${fmtMoney(profile.pnl)} $`} style={{ color: pnlColor(profile.pnl) }}>
              {profile.pnl > 0 ? '+' : ''}{fmtCompact(profile.pnl)} $
            </div>
          </div>

          <div className="card">
            <div className="card-t">Подключённые биржи</div>
            <ConnectionsTable
              rows={profile.exchangeConnections.map((c) => ({ ...c }))}
              onChanged={load}
              showResident={false}
            />
          </div>

          <div className="card">
            <div className="card-t">Последние закрытые сделки</div>
            {profile.recentClosedTrades.length === 0 ? (
              <div className="hint">Закрытых сделок пока нет.</div>
            ) : (
              <div className="tj-table">
                <div className="tj-row tj-row-trades th"><span>Тикер</span><span>Биржа</span><span>Направление</span><span>PnL</span><span>Закрыта</span></div>
                {profile.recentClosedTrades.map((t, i) => (
                  <div className="tj-row tj-row-trades" key={i}>
                    <span>{t.ticker}</span>
                    <span>{t.exchangeLabel}</span>
                    <span>{t.direction}</span>
                    <span style={{ color: pnlColor(t.pnl) }}>{t.pnl > 0 ? '+' : ''}{fmtMoney(t.pnl)} $</span>
                    <span>{fmtDate(t.closedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ConnectionsView() {
  const [connections, setConnections] = useState<TjConnection[] | null>(null)
  const [err, setErr] = useState('')

  function load() {
    getTjConnections().then(setConnections).catch((e) => setErr((e as Error).message))
  }
  useEffect(load, [])

  if (err) return <ErrorBanner err={err} />
  if (!connections) return <div className="td-empty">Загрузка…</div>

  return (
    <ConnectionsTable
      rows={connections.map((c) => ({ ...c, resident: { email: c.userEmail, apclub: c.apclub } }))}
      onChanged={load}
      showResident
    />
  )
}
