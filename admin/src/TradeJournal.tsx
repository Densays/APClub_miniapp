import { useEffect, useState } from 'react'
import Icon from './Icon'
import {
  getTjOverview, getTjUsers, getTjUserProfile, getTjConnections,
  type TjOverview, type TjUser, type TjUserProfile, type TjConnection,
} from './api'

// Вкладка «Trade Journal» — тонкая витрина над соседним проектом (личный
// кабинет резидентов для учёта сделок/бирж/PnL). Данные идут через
// server/src/tradejournal.ts, который проксирует TradeJournal'овский
// /api/admin/* с отдельным серверным секретом. Здесь только чтение —
// править данные резидента можно только в самом TradeJournal.

const MODE_LABELS: Record<string, string> = { ARBITRAGE: 'Арбитраж', TRADING: 'Трейдинг' }
const fmtMoney = (n: number) => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru-RU') : '—')
const pnlColor = (n: number) => (n < 0 ? 'var(--danger)' : 'var(--green)')

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

      {tab === 'overview' && <OverviewView onOpenUser={openUser} />}
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

function OverviewView({ onOpenUser: _onOpenUser }: { onOpenUser: (id: string) => void }) {
  const [data, setData] = useState<TjOverview | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    getTjOverview().then(setData).catch((e) => setErr((e as Error).message))
  }, [])

  if (err) return <ErrorBanner err={err} />
  if (!data) return <div className="td-empty">Загрузка…</div>

  const KPIS: { label: string; value: string; icon: string; color?: string }[] = [
    { label: 'Резидентов в Trade Journal', value: String(data.userCount), icon: 'users' },
    { label: 'Подключений бирж', value: String(data.connectionsByExchange.reduce((s, r) => s + r.count, 0)), icon: 'link' },
    { label: 'Суммарные депозиты', value: `${fmtMoney(data.depositTotal)} $`, icon: 'payments' },
    { label: 'Закрытых сделок', value: String(data.closedTradeCount), icon: 'chart' },
    { label: 'Win-rate платформы', value: data.winRate == null ? '—' : `${data.winRate.toFixed(0)}%`, icon: 'tasks' },
    { label: 'Суммарный PnL', value: `${data.pnl > 0 ? '+' : ''}${fmtMoney(data.pnl)} $`, icon: 'bonus', color: pnlColor(data.pnl) },
  ]

  return (
    <>
      <div className="kpi-grid">
        {KPIS.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpi-top">
              <span className="kpi-label">{k.label}</span>
              <span className="kpi-icon"><Icon name={k.icon} size={16} /></span>
            </div>
            <div className="kpi-value" style={k.color ? { color: k.color } : undefined}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-t">Подключения по биржам</div>
        {data.connectionsByExchange.length === 0 ? (
          <div className="hint">Подключений пока нет.</div>
        ) : (
          <div className="tj-table">
            <div className="tj-row tj-row-2 th"><span>Биржа</span><span>Подключений</span></div>
            {data.connectionsByExchange.map((row) => (
              <div className="tj-row tj-row-2" key={row.exchange}>
                <span>{row.exchange}</span>
                <span>{row.count}</span>
              </div>
            ))}
          </div>
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
        <span>Резидент</span><span>Режим</span><span>Биржи</span><span>Сделок</span><span>Win-rate</span><span>PnL</span>
      </div>
      {users.map((u) => (
        <button className="tj-row tj-row-users tj-row-btn" key={u.id} onClick={() => onOpen(u.id)}>
          <span>
            {u.displayName || u.email}
            {u.isAdmin && <span className="gold" style={{ marginLeft: 6, fontSize: 11 }}>ADMIN</span>}
          </span>
          <span>{MODE_LABELS[u.journalMode] ?? u.journalMode}</span>
          <span>{u.exchangeConnectionCount}</span>
          <span>{u.closedTradeCount}</span>
          <span>{u.winRate == null ? '—' : `${u.winRate.toFixed(0)}%`}</span>
          <span style={{ color: pnlColor(u.pnl) }}>{u.pnl > 0 ? '+' : ''}{fmtMoney(u.pnl)} $</span>
        </button>
      ))}
    </div>
  )
}

function UserDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [profile, setProfile] = useState<TjUserProfile | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    setProfile(null)
    getTjUserProfile(id).then(setProfile).catch((e) => setErr((e as Error).message))
  }, [id])

  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom: 14 }} onClick={onBack}>← Все резиденты</button>
      {err && <ErrorBanner err={err} />}
      {!err && !profile && <div className="td-empty">Загрузка…</div>}
      {profile && (
        <>
          <div className="card-t" style={{ marginBottom: 4 }}>{profile.displayName || profile.email}</div>
          <div className="hint" style={{ marginBottom: 16 }}>
            {profile.email} · {MODE_LABELS[profile.journalMode] ?? profile.journalMode}
          </div>

          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-top"><span className="kpi-label">Депозиты</span></div>
              <div className="kpi-value">{fmtMoney(profile.depositTotal)} $</div>
            </div>
            <div className="kpi">
              <div className="kpi-top"><span className="kpi-label">Закрытых сделок</span></div>
              <div className="kpi-value">{profile.closedTradeCount}</div>
            </div>
            <div className="kpi">
              <div className="kpi-top"><span className="kpi-label">Win-rate</span></div>
              <div className="kpi-value">{profile.winRate == null ? '—' : `${profile.winRate.toFixed(0)}%`}</div>
            </div>
            <div className="kpi">
              <div className="kpi-top"><span className="kpi-label">Суммарный PnL</span></div>
              <div className="kpi-value" style={{ color: pnlColor(profile.pnl) }}>
                {profile.pnl > 0 ? '+' : ''}{fmtMoney(profile.pnl)} $
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-t">Подключённые биржи</div>
            {profile.exchangeConnections.length === 0 ? (
              <div className="hint">Ни одной биржи не подключено.</div>
            ) : (
              <div className="tj-table">
                <div className="tj-row tj-row-conn th"><span>Биржа</span><span>Название</span><span>Последний синк</span><span>Статус</span></div>
                {profile.exchangeConnections.map((c, i) => (
                  <div className="tj-row tj-row-conn" key={i}>
                    <span>{c.exchange}</span>
                    <span>{c.label}</span>
                    <span>{fmtDate(c.lastSyncedAt)}</span>
                    <span style={{ color: c.lastSyncError ? 'var(--danger)' : c.lastSyncedAt ? 'var(--green)' : 'var(--gray)' }} title={c.lastSyncError ?? undefined}>
                      {c.lastSyncError ? 'ошибка' : c.lastSyncedAt ? 'ок' : 'не синхронизировано'}
                    </span>
                  </div>
                ))}
              </div>
            )}
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

  useEffect(() => {
    getTjConnections().then(setConnections).catch((e) => setErr((e as Error).message))
  }, [])

  if (err) return <ErrorBanner err={err} />
  if (!connections) return <div className="td-empty">Загрузка…</div>
  if (connections.length === 0) return <div className="td-empty">Подключений пока нет.</div>

  return (
    <div className="tj-table">
      <div className="tj-row tj-row-conn-full th"><span>Резидент</span><span>Биржа</span><span>Название</span><span>Последний синк</span><span>Статус</span></div>
      {connections.map((c) => (
        <div className="tj-row tj-row-conn-full" key={c.id}>
          <span>{c.userEmail}</span>
          <span>{c.exchange}</span>
          <span>{c.label}</span>
          <span>{fmtDate(c.lastSyncedAt)}</span>
          <span style={{ color: c.lastSyncError ? 'var(--danger)' : c.lastSyncedAt ? 'var(--green)' : 'var(--gray)' }} title={c.lastSyncError ?? undefined}>
            {c.lastSyncError ? 'ошибка' : c.lastSyncedAt ? 'ок' : 'не синхронизировано'}
          </span>
        </div>
      ))}
    </div>
  )
}
