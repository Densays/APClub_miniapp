// ─────────────────────────────────────────────────────────────────────────────
// Каталог контента клуба: достижения и названия уровней разблокировки.
//
// Пока это статические данные (совпадают с frontend/src/mock.ts). Отдаются через
// GET /api/catalog, чтобы браузерная админка не держала свою копию.
// На будущее — «Конструктор контента»: вынести в редактируемую таблицу Supabase.
// ─────────────────────────────────────────────────────────────────────────────

export type Achievement = { id: string; title: string; icon: string; group: 'money' | 'role' }

export const ACHIEVEMENTS: Achievement[] = [
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

// Перки Витрины клуба по умолчанию (открываются за N звёзд-достижений).
// Редактируются в админке и хранятся в БД; это — сид при первом обращении.
export type Perk = { stars: number; title: string; icon: string }

export const DEFAULT_PERKS: Perk[] = [
  { stars: 1, title: 'Доступ к кабинету APClub', icon: '🔑' },
  { stars: 2, title: 'Доступ к каналу SpreadHunter', icon: '📡' },
  { stars: 5, title: 'Доступ к блоку DEX', icon: '🔄' },
  { stars: 10, title: 'Групповой мастермайнд — 1 раз в месяц', icon: '🧠' },
  { stars: 16, title: 'Возможность попасть в команду тестировщиков', icon: '🧪' },
]

// Названия 12 уровней разблокировки (индекс = номер месяца).
export const LEVELS: string[] = [
  'Зритель',
  'Новичок',
  'Практик',
  'Трейдер',
  'Аналитик',
  'Стратег',
  'Профи',
  'Ментор',
  'Эксперт',
  'Мастер',
  'Гуру',
  'Легенда',
]
