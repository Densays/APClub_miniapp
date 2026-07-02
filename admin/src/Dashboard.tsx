import { useEffect, useState } from 'react'
import { getStats, getProfiles, type Stats, type Profile } from './api'
import Icon from './Icon'
import LineChart from './LineChart'

const DAY = 86400000
const PERIOD_LABEL: Record<string, string> = { monthly: 'мес', quarterly: 'квартал', semiannual: 'полгода', annual: 'год' }
const nameOf = (p: Profile) => `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || `id ${p.userId}`
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

const hasData = (arr: { value: number | null }[]) => arr.some((p) => p.value != null)
// Последнее известное значение тренда — чтобы число в заголовке совпадало с концом графика.
const lastVal = (arr: { value: number | null }[]) => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].value != null) return arr[i].value as number
  return null
}

// Retention и Churn вынесены в отдельные графики трендов ниже — в KPI не дублируем.
const KPIS: { key: keyof Stats; label: string; icon: string; suffix?: string; hint?: string }[] = [
  { key: 'total', label: 'Всего резидентов', icon: 'users', hint: 'все профили клуба' },
  { key: 'active', label: 'Активные', icon: 'leaders', hint: 'запуск за 7 дней' },
  { key: 'inactive', label: 'Неактивные', icon: 'referrals', hint: 'без запуска 7+ дней' },
  { key: 'engaged', label: 'Вовлечённые', icon: 'bonus', hint: '3+ дней активности' },
]

export default function Dashboard({ onOpenMember }: { onOpenMember?: (id: string) => void }) {
  const [s, setS] = useState<Stats | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [err, setErr] = useState('')

  async function load() {
    setErr('')
    try { setS(await getStats()) }
    catch (e) { setErr((e as Error).message === 'unauth' ? 'Сессия истекла' : 'Не удалось загрузить статистику') }
    try { setMembers(await getProfiles()) } catch { /* платежи не критичны */ }
  }
  useEffect(() => { load() }, [])

  // Платежи: у кого задан срок (accessUntil). Активные — по близости даты (сверху ближайшие),
  // просроченные — дата в прошлом (сверху недавно истёкшие). Без даты — не в таблице платежей.
  const now = Date.now()
  const dated = members.filter((m) => typeof m.accessUntil === 'number')
  const active = dated.filter((m) => (m.accessUntil as number) >= now).sort((a, b) => (a.accessUntil as number) - (b.accessUntil as number))
  const overdue = dated.filter((m) => (m.accessUntil as number) < now).sort((a, b) => (b.accessUntil as number) - (a.accessUntil as number))
  const daysTo = (ts: number) => Math.round((ts - now) / DAY)

  const series = s?.launches.series ?? []
  const max = Math.max(1, ...series.map((d) => d.launches))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Дашборд</h1>
          <div className="page-sub">Обзор активности клуба и ключевые метрики</div>
        </div>
        <button className="btn btn-ghost" onClick={load}>Обновить</button>
      </div>
      {err && <div className="err">{err}</div>}
      {!s && !err && <div className="td-empty">Загрузка…</div>}

      {s && (
        <>
          <div className="kpi-grid">
            {KPIS.map((k) => (
              <div className="kpi" key={k.key}>
                <div className="kpi-top">
                  <span className="kpi-label">{k.label}</span>
                  <span className="kpi-icon"><Icon name={k.icon} size={16} /></span>
                </div>
                <div className="kpi-value">{s[k.key] as number}{k.suffix ?? ''}</div>
                <div className="kpi-hint">{k.hint}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-t">
              Запуски приложения по дням (14 дн.)
              <span className="gold">сегодня {s.launches.today} · всего {s.launches.total}</span>
            </div>
            {s.launches.total === 0 ? (
              <div className="hint">Пока нет запусков. Данные появятся, как только резиденты откроют приложение.</div>
            ) : (
              <div className="chart">
                {series.map((d) => (
                  <div className="chart-col" key={d.date} title={`${d.date}: ${d.launches}`}>
                    <div className="chart-bar-wrap">
                      <div className="chart-bar" style={{ height: `${(d.launches / max) * 100}%` }}>
                        {d.launches > 0 && <span className="chart-val">{d.launches}</span>}
                      </div>
                    </div>
                    <div className="chart-x">{d.date.slice(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="row-cards">
            <div className="card">
              <div className="card-t">Retention Rate (6 мес.) <span className="gold">{lastVal(s.retentionSeries) ?? '—'}%</span></div>
              {hasData(s.retentionSeries)
                ? <LineChart data={s.retentionSeries} color="var(--gold)" />
                : <div className="hint">Тренд появится, когда накопится активность за 2+ месяца.</div>}
            </div>
            <div className="card">
              <div className="card-t">Churn Rate (6 мес.) <span className="gold">{lastVal(s.churnSeries) ?? '—'}%</span></div>
              {hasData(s.churnSeries)
                ? <LineChart data={s.churnSeries} color="var(--danger)" />
                : <div className="hint">Тренд появится, когда накопится активность за 2+ месяца.</div>}
            </div>
          </div>

          {/* Платежи резидентов: действующие (по близости даты) + просроченные */}
          <div className="row-cards">
            <div className="card">
              <div className="card-t">Действующие · ближайшие платежи <span className="gold">{active.length}</span></div>
              {active.length === 0 ? (
                <div className="hint">Нет резидентов с заданной датой платежа. Задай «Срок доступа / платёж» в карточке участника.</div>
              ) : (
                <div className="pay-list">
                  {active.map((m) => {
                    const d = daysTo(m.accessUntil as number)
                    const urg = Math.max(0.05, Math.min(1, 1 - d / 90))
                    const cls = d <= 7 ? 'red' : d <= 30 ? 'warn' : 'ok'
                    return (
                      <button className="pay-row" key={m.userId} onClick={() => onOpenMember?.(m.userId)} title="Открыть участника">
                        <span className="pay-name">{nameOf(m)}</span>
                        <span className="pay-meta">{fmtDate(m.accessUntil as number)}{m.billingPeriod ? ` · ${PERIOD_LABEL[m.billingPeriod]}` : ''}</span>
                        <span className="pay-bar"><span className={`pay-fill ${cls}`} style={{ width: `${urg * 100}%` }} /></span>
                        <span className={`pay-days ${cls}`}>{d <= 0 ? 'сегодня' : `${d} дн`}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-t">Просроченные платежи <span className="pay-danger">{overdue.length}</span></div>
              {overdue.length === 0 ? (
                <div className="hint">Просрочек нет 👍</div>
              ) : (
                <div className="pay-list">
                  {overdue.map((m) => {
                    const d = -daysTo(m.accessUntil as number)
                    return (
                      <button className="pay-row overdue" key={m.userId} onClick={() => onOpenMember?.(m.userId)} title="Открыть участника">
                        <span className="pay-name">{nameOf(m)}</span>
                        <span className="pay-meta">{fmtDate(m.accessUntil as number)}{m.billingPeriod ? ` · ${PERIOD_LABEL[m.billingPeriod]}` : ''}</span>
                        <span className="pay-bar"><span className="pay-fill red" style={{ width: '100%' }} /></span>
                        <span className="pay-days red">просрочено {d} дн</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
