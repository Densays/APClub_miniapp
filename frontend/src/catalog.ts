import { useEffect, useState } from 'react'
import { achievements as MOCK_ACH } from './mock'
import type { Achievement } from './mock'

// Живой каталог достижений: единый источник — БД (то, что настроено в разделе
// «Геймификация» админки). Правки в админке отображаются здесь после публикации.
// mock — фолбэк на случай недоступности API. Кэш на уровень модуля, чтобы не
// дёргать сеть на каждом экране.

const API_BASE = (import.meta.env.VITE_API_URL as string) || ''

type Catalog = { achievements: Achievement[]; levels: string[] }
let cache: Catalog | null = null
let inflight: Promise<Catalog> | null = null

async function fetchCatalog(): Promise<Catalog> {
  const r = await fetch(`${API_BASE}/api/catalog`)
  if (!r.ok) throw new Error(`catalog ${r.status}`)
  const d = await r.json()
  cache = {
    achievements: (d.achievements as Achievement[])?.length ? (d.achievements as Achievement[]) : MOCK_ACH,
    levels: (d.levels as string[]) ?? [],
  }
  return cache
}

const FALLBACK: Catalog = { achievements: MOCK_ACH, levels: [] }

export function useCatalog(): Catalog {
  const [cat, setCat] = useState<Catalog>(cache ?? FALLBACK)
  useEffect(() => {
    if (cache) { setCat(cache); return }
    let alive = true
    inflight = inflight || fetchCatalog()
    inflight.then((c) => { if (alive) setCat(c) }).catch(() => {})
    return () => { alive = false }
  }, [])
  return cat
}

// Удобный хелпер: только список достижений.
export function useAchievements(): Achievement[] {
  return useCatalog().achievements
}
