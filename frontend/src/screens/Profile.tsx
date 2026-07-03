import { useEffect, useState } from 'react'
import './Profile.css'
import Header from '../components/Header'
import { mockUser, mockLevels, profileMenu, SUPPORT_URL } from '../mock'
import { getCurrentUser } from '../tgUser'
import { getMyProfile } from '../api'
import type { ProfileData, Unlock } from '../api'
import { useCatalog } from '../catalog'

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}


function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export default function Profile({
  onBack,
  onEdit,
  onOpenAchievements,
  onOpenLeaderboard,
  onOpenShowcase,
  onOpenAdmin,
}: {
  onBack?: () => void
  onEdit?: () => void
  onOpenAchievements?: () => void
  onOpenLeaderboard?: () => void
  onOpenShowcase?: () => void
  onOpenAdmin?: () => void
}) {
  // Имя и аватар — из Telegram (в браузере — мок).
  const tg = getCurrentUser()
  const u = mockUser

  // Сохранённый профиль + прогресс разблокировки из общей базы.
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [unlock, setUnlock] = useState<Unlock>({ current: 0, total: 12 })
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    let alive = true
    getMyProfile()
      .then(({ profile, unlock, isAdmin }) => {
        if (!alive) return
        setProfile(profile)
        setUnlock(unlock)
        setIsAdmin(isAdmin)
      })
      .catch(() => { /* сервер недоступен — показываем моки */ })
    return () => { alive = false }
  }, [])

  const pct = unlock.total ? Math.round((unlock.current / unlock.total) * 100) : 0

  // Названия статусов по месяцам берём из каталога (редактируются в админке);
  // фолбэк — моки. month = индекс + 1.
  const catalog = useCatalog()
  const levelNames = catalog.levels.length ? catalog.levels : mockLevels.map((l) => l.name)

  // «Продлить подписку» → личка аккаунта поддержки (ссылка задаётся в SUPPORT_URL).
  function openSupport() {
    if (!SUPPORT_URL) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tg = (window as any)?.Telegram?.WebApp
    if (tg?.openTelegramLink && SUPPORT_URL.includes('t.me')) tg.openTelegramLink(SUPPORT_URL)
    else window.open(SUPPORT_URL, '_blank')
  }
  // Статус уровня: открыт (<= current), скоро (следующий), закрыт (дальше).
  const levelState = (month: number): 'unlocked' | 'soon' | 'locked' =>
    month <= unlock.current ? 'unlocked' : month === unlock.current + 1 ? 'soon' : 'locked'

  const name = `${profile?.firstName || tg.firstName} ${profile?.lastName || tg.lastName}`.trim()
  const avatar = profile?.avatar || tg.avatar
  const initials = `${(profile?.firstName || tg.firstName)[0] ?? ''}${(profile?.lastName || tg.lastName)[0] ?? ''}` || 'AP'
  // Реальные данные профиля. НЕ подставляем мок — у нового участника поля пустые.
  const focus = profile?.focus ?? ''
  const occupation = profile?.occupation ?? ''
  const city = profile?.city ?? ''
  const email = profile?.email ?? ''

  return (
    <div className="profile">
      <Header title="APClub" onBack={onBack} />

      <div className="profile-body">
        {/* Подшапка: Назад + поиск */}
        <div className="pf-subhead">
          <button className="pf-back" onClick={onBack}>‹ Назад</button>
          <button className="pf-search" aria-label="Поиск"><SearchIcon /></button>
        </div>

        {/* Карточка пользователя — имя и аватар из Telegram */}
        <div className="pf-user">
          <div className="pf-user-avatar">
            {avatar ? <img src={avatar} alt="" /> : <span>{initials}</span>}
          </div>
          <div className="pf-user-info">
            <div className="pf-user-name">{name}</div>
            <div className="pf-user-meta">
              <span className="pf-badge">{u.plan}</span>
              <span className="pf-until">до {u.planUntil}</span>
            </div>
          </div>
          <button className="pf-edit" onClick={onEdit}>Редактировать</button>
        </div>

        {/* О себе — только заполненные поля (у нового участника блок пуст) */}
        {(focus || occupation || city || email) && (
          <div className="pf-about">
            {occupation && <div className="pf-about-occ">{occupation}</div>}
            {focus && <div className="pf-about-bio">{focus}</div>}
            {city && <div className="pf-about-row"><PinIcon /><span>{city}</span></div>}
            {email && <div className="pf-about-row"><MailIcon /><span>{email}</span></div>}
          </div>
        )}
        {profile?.maxResult && (
          <div className="mp-results" style={{ margin: '0 16px 14px' }}>
            <div className="mp-result"><span>Максимум за месяц</span><b>{profile.maxResult}</b></div>
          </div>
        )}

        {/* Прогресс разблокировки */}
        <div className="pf-progress">
          <div className="pf-progress-head">
            <span>Прогресс разблокировки</span>
            <span className="pf-progress-count">{unlock.current} / {unlock.total}</span>
          </div>
          <div className="pf-progress-bar">
            <div className="pf-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Награды по месяцам (горизонтальный скролл) */}
        <div className="pf-levels">
          {levelNames.map((name, i) => {
            const month = i + 1
            const state = levelState(month)
            return (
            <div className="pf-level" key={month}>
              <div className="pf-level-month">{month} месяц</div>
              <div className="pf-level-badge">{name}</div>
              <div className={`pf-level-circle${state === 'soon' ? ' is-active' : ''}${state === 'unlocked' ? ' is-done' : ''}`}>
                {state === 'unlocked' ? <CheckIcon /> : <ClockIcon />}
              </div>
              <div className={`pf-level-status${state === 'soon' ? ' is-soon' : ''}${state === 'unlocked' ? ' is-done' : ''}`}>
                {state === 'unlocked' ? 'Открыто' : state === 'soon' ? 'Скоро появится' : 'Закрыто'}
              </div>
            </div>
            )
          })}
        </div>

        <div className="pf-scroll-hint">
          Прокрутите, чтобы увидеть все награды <span>›</span>
        </div>

        {/* Меню */}
        <div className="pf-menu">
          {profileMenu.map((m) => (
            <button
              className="pf-menu-item"
              key={m}
              onClick={
                m === 'Достижения'
                  ? onOpenAchievements
                  : m === 'Таблица лидеров'
                  ? onOpenLeaderboard
                  : m === 'Витрина клуба'
                  ? onOpenShowcase
                  : undefined
              }
            >
              <span>{m}</span>
              <span className="pf-chevron">›</span>
            </button>
          ))}
        </div>

        {/* Продлить подписку */}
        {isAdmin && (
          <button className="pf-menu-item pf-admin" onClick={onOpenAdmin}>
            <span>⚙️ Админ-панель</span>
            <span className="pf-chevron">›</span>
          </button>
        )}

        <button className="pf-subscribe" onClick={openSupport}>Продлить подписку</button>
      </div>
    </div>
  )
}
