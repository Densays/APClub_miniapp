import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, ProfileStore } from './store.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Реализация ProfileStore поверх Supabase (Postgres).
//
// Таблица (см. SQL в README/миграции):
//   create table profiles (
//     user_id    text primary key,
//     data       jsonb not null default '{}',
//     updated_at timestamptz default now()
//   );
//
// Профиль целиком хранится в колонке data (jsonb) — гибко и совпадает с
// семантикой upsert(patch): читаем → мержим → пишем. Роуты этот класс не видят,
// работают только через интерфейс ProfileStore.
// ─────────────────────────────────────────────────────────────────────────────

const TABLE = 'profiles'

export class SupabaseProfileStore implements ProfileStore {
  private db: SupabaseClient

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  async get(userId: string): Promise<Profile | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('data')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return { ...(data.data as Profile), userId }
  }

  async list(): Promise<Profile[]> {
    const { data, error } = await this.db.from(TABLE).select('user_id, data')
    if (error) throw error
    return (data ?? []).map((row) => ({
      ...(row.data as Profile),
      userId: row.user_id as string,
    }))
  }

  async upsert(userId: string, patch: Partial<Profile>): Promise<Profile> {
    const prev = (await this.get(userId)) ?? { userId }
    const next: Profile = { ...prev, ...patch, userId, updatedAt: Date.now() }
    const { error } = await this.db
      .from(TABLE)
      .upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() })
    if (error) throw error
    return next
  }

  async remove(userId: string): Promise<void> {
    const { error } = await this.db.from(TABLE).delete().eq('user_id', userId)
    if (error) throw error
  }

  // Гейт регистрации без вытягивания всей таблицы с base64-аватарами: тянем
  // ТОЛЬКО user_id + email + признак регистрации (jsonb-проекция), фильтруем в JS.
  // ~40 байт/строка вместо ~30 КБ (avatar) — снимает O(N²)-нагрузку при наплыве.
  async emailOwner(emailNorm: string, excludeUserId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('user_id, email:data->>email, reg:data->>registeredAt')
    if (error) throw error
    for (const row of (data ?? []) as { user_id: string; email: string | null; reg: string | null }[]) {
      if (row.user_id === excludeUserId || row.user_id.startsWith('__')) continue
      if (row.reg && String(row.email ?? '').trim().toLowerCase() === emailNorm) return row.user_id
    }
    return null
  }
}
