import { useEffect, useMemo, useState } from 'react'
import './Calendar.css'
import { getProfiles } from '../api'
import { LINKS, openLink } from '../mock'
import EfirJoinModal from './EfirJoinModal'

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]
// Неделя начинается с понедельника, воскресенье — последний столбец
const WEEKDAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']
const WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

const pad = (n: number) => String(n).padStart(2, '0')

// mm-dd из даты рождения (поддержка yyyy-mm-dd и dd.mm.yyyy)
function bdKey(bd?: string): string | null {
  if (!bd) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(bd)) return `${bd.slice(5, 7)}-${bd.slice(8, 10)}`
  if (/^\d{2}\.\d{2}\.\d{4}/.test(bd)) return `${bd.slice(3, 5)}-${bd.slice(0, 2)}`
  return null
}

type Ev = { icon: string; title: string; text: string; record?: boolean; join?: boolean }

export default function Calendar({ date = new Date() }: { date?: Date }) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const today = date.getDate()

  const [selected, setSelected] = useState(today)
  const [birthdays, setBirthdays] = useState<Record<string, string[]>>({})
  const [showJoin, setShowJoin] = useState(false)

  useEffect(() => {
    let alive = true
    getProfiles()
      .then((list) => {
        if (!alive) return
        const map: Record<string, string[]> = {}
        for (const p of list) {
          const k = bdKey(p.birthDate)
          if (!k) continue
          const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'Участник'
          ;(map[k] ??= []).push(name)
        }
        setBirthdays(map)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // сдвиг первого дня: понедельник = 0
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const events: Ev[] = useMemo(() => {
    const dt = new Date(year, month, selected)
    const dow = dt.getDay()
    const evs: Ev[] = []
    const names = birthdays[`${pad(month + 1)}-${pad(selected)}`]
    if (names?.length) evs.push({ icon: '🎂', title: 'День рождения', text: `у резидента APClub ${names.join(', ')}` })
    if (dow === 1) evs.push({ icon: '📝', title: 'Начало недели', text: 'Поставь план на неделю' })
    const past = selected < today // день уже прошёл (текущий месяц) → есть запись
    if (dow === 3) evs.push({ icon: '🎙️', title: 'Онлайн-среда', text: '17:00 МСК', record: past })
    if (dow === 4) evs.push({ icon: '🎥', title: 'Эфир в клубе', text: '19:00 МСК', record: past, join: !past })
    if (dow === 0) evs.push({ icon: '✅', title: 'Итоги недели', text: 'Подведи итоги недели' })
    return evs
  }, [selected, birthdays, year, month])

  const selDow = new Date(year, month, selected).getDay()

  return (
    <div className="calendar card">
      <div className="cal-left">
        <div className="cal-head">
          <span className="cal-month gold">{MONTHS[month]}</span>
          <span className="cal-year dim">{year}</span>
        </div>

        <div className="cal-grid cal-weekdays">
          {WEEKDAYS.map((w) => <div key={w} className="cal-wd dim">{w}</div>)}
        </div>

        <div className="cal-grid">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="cal-day is-empty" />
            const dow = new Date(year, month, d).getDay()
            const cls = [
              'cal-day',
              d === selected ? 'is-selected' : '',
              d === today ? 'is-today' : '',
              dow === 3 ? 'meet-wed' : '',
              dow === 4 ? 'meet-thu' : '',
              birthdays[`${pad(month + 1)}-${pad(d)}`] ? 'has-bd' : '',
            ].join(' ').trim()
            return (
              <button key={i} className={cls} onClick={() => setSelected(d)}>{d}</button>
            )
          })}
        </div>
      </div>

      <div className="cal-events">
        <div className="cal-ev-date">
          <span className="cal-ev-day">{selected} {MONTHS_GEN[month]}</span>
          <span className="cal-ev-dow">{WD_FULL[selDow]}</span>
        </div>
        {events.length > 0 ? (
          <div className="cal-ev-list">
            {events.map((e, i) => (
              <div className="cal-ev" key={i}>
                <span className="cal-ev-icon">{e.icon}</span>
                <span className="cal-ev-text">
                  <span className="cal-ev-title">{e.title}</span>
                  <span className="cal-ev-sub">{e.text}</span>
                  {e.record && (
                    <button className="cal-ev-rec" onClick={() => openLink(LINKS.streams)}>▶ Посмотреть запись</button>
                  )}
                  {e.join && (
                    <button className="cal-ev-rec" onClick={() => setShowJoin(true)}>Войти в Zoom →</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="cal-ev-empty">Событий нет</div>
        )}
      </div>
      {showJoin && <EfirJoinModal onClose={() => setShowJoin(false)} />}
    </div>
  )
}
