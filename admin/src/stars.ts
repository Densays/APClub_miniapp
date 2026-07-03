// ─────────────────────────────────────────────────────────────────────────────
// Единый расчёт «звёзд» резидента (копия frontend/src/stars.ts — держать синхронно).
//
// ПРАВИЛО: звёзды = число полученных money-достижений (achievements[])
//          + число ролей, доведённых до Тира 5 (roleTiers[roleId] >= 5).
// Тиры 1–4 у роли — только прогресс, звёзды НЕ дают.
// Обратная совместимость: role-id в старом achievements[] трактуется как Тир 5.
// ─────────────────────────────────────────────────────────────────────────────

export type StarCatalogItem = { id: string; group: 'money' | 'role' }
export type StarProfile = {
  achievements?: string[]
  roleTiers?: Record<string, number>
}

export const TIER_MAX = 5

export function computeStars(profile: StarProfile | null | undefined, catalog: StarCatalogItem[]): number {
  if (!profile) return 0
  const earned = new Set(profile.achievements ?? [])
  const tiers = profile.roleTiers ?? {}
  let stars = 0
  for (const item of catalog) {
    if (item.group === 'money') {
      if (earned.has(item.id)) stars++
    } else {
      if ((tiers[item.id] ?? 0) >= TIER_MAX || earned.has(item.id)) stars++
    }
  }
  return stars
}

export function maxStars(catalog: StarCatalogItem[]): number {
  return catalog.length
}
