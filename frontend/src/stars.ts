// ─────────────────────────────────────────────────────────────────────────────
// Единый расчёт «звёзд» резидента.
//
// ПРАВИЛО: звёзды = число полученных money-достижений (achievements[])
//          + число ролей, доведённых до Тира 5 (roleTiers[roleId] >= 5).
// Тиры 1–4 у роли — только прогресс, звёзды НЕ дают.
//
// Обратная совместимость: если role-id лежит в старом achievements[] (до тиров),
// трактуем его как Тир 5 (= звезда). Максимум звёзд = число позиций каталога.
//
// NB: этот файл продублирован в admin/src/stars.ts — держать синхронно.
// ─────────────────────────────────────────────────────────────────────────────

export type StarCatalogItem = { id: string; group: 'money' | 'role' }
export type StarProfile = {
  achievements?: string[]
  roleTiers?: Record<string, number>
}

export const TIER_MAX = 5

// Число звёзд у профиля по актуальному каталогу.
export function computeStars(profile: StarProfile | null | undefined, catalog: StarCatalogItem[]): number {
  if (!profile) return 0
  const earned = new Set(profile.achievements ?? [])
  const tiers = profile.roleTiers ?? {}
  let stars = 0
  for (const item of catalog) {
    if (item.group === 'money') {
      if (earned.has(item.id)) stars++
    } else {
      // роль: звезда за Тир 5 (или legacy role-id в achievements)
      if ((tiers[item.id] ?? 0) >= TIER_MAX || earned.has(item.id)) stars++
    }
  }
  return stars
}

// Максимум достижимых звёзд = все позиции каталога (каждая money = 1, каждая роль@тир5 = 1).
export function maxStars(catalog: StarCatalogItem[]): number {
  return catalog.length
}

// Позиции каталога, за которые у профиля НАЧИСЛЕНА звезда (money получено / роль на Тире 5).
// Длина = computeStars — счётчик и список звёзд всегда совпадают.
export function starItems<T extends StarCatalogItem>(profile: StarProfile | null | undefined, catalog: T[]): T[] {
  if (!profile) return []
  const earned = new Set(profile.achievements ?? [])
  const tiers = profile.roleTiers ?? {}
  return catalog.filter((item) =>
    item.group === 'money'
      ? earned.has(item.id)
      : (tiers[item.id] ?? 0) >= TIER_MAX || earned.has(item.id),
  )
}
