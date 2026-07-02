-- Таблица профилей резидентов APClub.
-- Выполнить один раз в Supabase → SQL Editor.
--
-- Профиль целиком хранится в jsonb-колонке data (гибко, без миграций под каждое поле).
-- Доступ к таблице — только через сервер с SERVICE ROLE key, поэтому RLS можно
-- держать включённым без публичных политик (service key её обходит).

create table if not exists public.profiles (
  user_id    text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Включаем RLS: клиентский (anon) доступ запрещён, сервер ходит по service key.
alter table public.profiles enable row level security;

-- Индекс на updated_at для сортировок в списке участников / админке.
create index if not exists profiles_updated_at_idx on public.profiles (updated_at desc);
