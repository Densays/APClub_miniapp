import { useEffect, useState } from 'react'
import { getStats, type Stats } from './api'
import Icon from './Icon'
import LineChart from './LineChart'

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

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null)
  const [err, setErr] = useState('')

  async function load() {
    setErr('')
    try { setS(await getStats()) }
    catch (e) { setErr((e as Error).message === 'unauth' ? 'Сессия истекла' : 'Не удалось загрузить статистику') }
  }
  useEffect(() => { load() }, [])

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
        </>
      )}
    </div>
  )
}
