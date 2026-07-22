// Mock-данные для верстки экранов по референсу APClub.
// Позже заменяются реальными ответами API.

export const mockUser = {
  firstName: 'Denis',
  lastName: 'Sh',
  username: 'denflow',
  avatar: '', // пусто -> плейсхолдер с инициалами
  plan: 'Пробный',
  planUntil: '09.05.2026',
  bio: 'Суетолог в APClub',
  city: 'Буэнос Айрес',
  family: 'Женат',
}

// Профиль резидента — расширенные данные для экрана профиля.
// Позже заменяются реальными ответами API.
export const mockProfile = {
  daysInClub: 54,
  efirsAttended: 12,
  reportsSent: 8,
  experience: '2 года',
  direction: 'Futures',
  goal: 'Стабильный доход с арбитража',
}

// Прогресс разблокировки наград по месяцам членства.
// state: 'soon' — скоро появится (ближайшая), 'locked' — закрыто, 'unlocked' — открыто.
export const mockUnlock = { current: 0, total: 12 }

export type LevelState = 'unlocked' | 'soon' | 'locked'
export const mockLevels: { month: number; name: string; state: LevelState }[] = [
  { month: 1, name: 'Зритель', state: 'soon' },
  { month: 2, name: 'Новичок', state: 'locked' },
  { month: 3, name: 'Практик', state: 'locked' },
  { month: 4, name: 'Опытный', state: 'locked' },
  { month: 5, name: 'Профи', state: 'locked' },
  { month: 6, name: 'Эксперт', state: 'locked' },
  { month: 7, name: 'Мастер', state: 'locked' },
  { month: 8, name: 'Гуру', state: 'locked' },
  { month: 9, name: 'Ветеран', state: 'locked' },
  { month: 10, name: 'Наставник', state: 'locked' },
  { month: 11, name: 'Амбассадор', state: 'locked' },
  { month: 12, name: 'Легенда', state: 'locked' },
]

// Пункты меню на экране профиля
export const profileMenu = [
  'Достижения',
  'Таблица лидеров',
  'Витрина клуба',
]

// Ссылка на аккаунт поддержки (личка) для кнопки «Продлить подписку».
// TODO: вписать реальную ссылку t.me/... перед финальной проверкой.
export const SUPPORT_URL: string = ''

// Внешние ссылки карточек
export const LINKS = {
  arsenal: 'https://arbitrage.eduonline.io/learn/n2OyCG3jykCeybPGTGrIag/theory',
  streams: 'https://arbitrage.eduonline.io/',
  chat: 'https://t.me/+2I03_UzJMSw2ZDYy',
  arbix: 'https://www.arbix.pro/',
  razbor: 'https://apcrypto.club/razborsave',
  // Комната «Эфир в клубе» (Zoom). Открывается только после формы входа —
  // см. EfirJoinModal.
  efirRoom: 'https://us06web.zoom.us/j/86599061251?pwd=Kzhkb7XaYgcsbNLZbU8wlodETJRu1H.1',
}

// Открыть внешнюю ссылку (в Telegram — через нативный API, иначе новая вкладка).
export function openLink(url: string) {
  if (!url) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tg = (window as any)?.Telegram?.WebApp
  if (tg?.openTelegramLink && url.includes('t.me')) tg.openTelegramLink(url)
  else if (tg?.openLink) tg.openLink(url)
  else window.open(url, '_blank')
}

// Витрина клуба: перки, открываемые количеством звёзд (достижений).
export const clubPerks: { stars: number; title: string; icon: string }[] = [
  { stars: 1, title: 'Доступ к кабинету APClub', icon: '🔑' },
  { stars: 2, title: 'Доступ к каналу SpreadHunter', icon: '📡' },
  { stars: 5, title: 'Доступ к блоку DEX', icon: '🔄' },
  { stars: 10, title: 'Групповой мастермайнд — 1 раз в месяц', icon: '🧠' },
  { stars: 16, title: 'Возможность попасть в команду тестировщиков', icon: '🧪' },
]

// Каталог достижений (ачивок). group: 'money' — базовые, 'role' — дополнительные.
export type Achievement = { id: string; title: string; icon: string; group: 'money' | 'role' }
export const achievements: Achievement[] = [
  { id: 'money_100', title: 'Первые $100 (за месяц)', icon: '💵', group: 'money' },
  { id: 'money_500', title: 'Первые $500 (за месяц)', icon: '💵', group: 'money' },
  { id: 'money_1000', title: 'Первые $1 000 (за месяц)', icon: '💰', group: 'money' },
  { id: 'money_3000', title: 'Первые $3 000 (за месяц)', icon: '💰', group: 'money' },
  { id: 'money_5000', title: 'Первые $5 000 (за месяц)', icon: '💎', group: 'money' },
  { id: 'money_10000', title: 'Первые $10 000 (за месяц)', icon: '💎', group: 'money' },
  { id: 'dep_30', title: 'Первые +30% к депозиту (за месяц)', icon: '📈', group: 'money' },
  { id: 'dep_50', title: 'Первые +50% к депозиту (за месяц)', icon: '📈', group: 'money' },
  { id: 'dep_100', title: 'Первые +100% к депозиту (за месяц)', icon: '🚀', group: 'money' },
  { id: 'trade_first', title: 'Первая сделка', icon: '🤝', group: 'money' },
  { id: 'trade_100', title: 'Первые 100 сделок', icon: '💯', group: 'money' },
  { id: 'winrate_80', title: 'Винрейт 80%', icon: '🎯', group: 'money' },
  { id: 'winrate_90', title: 'Винрейт 90%', icon: '🏆', group: 'money' },
  { id: 'blown_depo', title: 'Слил деп на трейдинге', icon: '📉', group: 'money' },
  { id: 'systematic', title: 'Системный', icon: '⚙️', group: 'money' },
  { id: 'role_insider', title: 'Инсайдер клуба', icon: '🕵️', group: 'role' },
  { id: 'role_mentor', title: 'Наставник', icon: '🎓', group: 'role' },
  { id: 'role_expert', title: 'Эксперт', icon: '🧠', group: 'role' },
  { id: 'role_sporthunter', title: 'Спортхантер', icon: '🎯', group: 'role' },
  { id: 'role_activist', title: 'Активист', icon: '⚡', group: 'role' },
  { id: 'role_host', title: 'Ведущий', icon: '🎤', group: 'role' },
  { id: 'role_supplier', title: 'Поставщик связок', icon: '🔗', group: 'role' },
]

// Ближайшая встреча для таймера «До встречи».
// Расписание по МСК (UTC+3): Ср 17:00 и Чт 19:00. Возвращает абсолютный момент
// (timestamp), поэтому таймер считает корректно в любом часовом поясе зрителя.
export function getNextMeeting(): number {
  const meetings = [
    { dow: 3, h: 17 }, // среда 17:00 МСК
    { dow: 4, h: 19 }, // четверг 19:00 МСК
  ]
  const now = Date.now()
  const msk = new Date(now + 3 * 3600 * 1000) // «стенные» часы МСК через UTC-поля
  const y = msk.getUTCFullYear()
  const mo = msk.getUTCMonth()
  const d = msk.getUTCDate()
  let best = Infinity
  for (const mt of meetings) {
    for (let add = 0; add <= 7; add++) {
      const ts = Date.UTC(y, mo, d + add, mt.h - 3, 0, 0) // МСК h:00 → UTC (h−3):00
      const mskDow = new Date(ts + 3 * 3600 * 1000).getUTCDay()
      if (mskDow === mt.dow && ts > now) {
        if (ts < best) best = ts
        break
      }
    }
  }
  return Number.isFinite(best) ? best : now
}

export const mockArsenal = [
  {
    id: 1,
    tag: 'Модуль 1',
    title: 'Оценка текущих активов',
    result: 'Разберётесь в эффективности портфеля и составите план.',
  },
  {
    id: 2,
    tag: 'Модуль 2',
    title: 'Основные правила и понятия',
    result: 'Узнаете базовые термины и принципы работы рынка.',
  },
  {
    id: 3,
    tag: 'Сервис',
    title: 'Доступ к сервису со спредами',
    result: 'Уведомления о спредах и доступ к торговому боту.',
  },
]
