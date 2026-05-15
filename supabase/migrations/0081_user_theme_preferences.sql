-- ============================================================
-- Migration 0081 — user_theme_preferences
-- ============================================================
-- Stocke le thème UI choisi par chaque user (registry défini côté code
-- dans themes/_registry.ts). Pas de contrainte FK sur le slug : le registry
-- évolue côté code, la DB ne fait que persister le choix.
-- RLS : un user ne lit/écrit que sa propre préférence.
-- ============================================================

create table if not exists public.user_theme_preferences (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  theme_slug  text not null default 'default',
  selected_at timestamptz not null default now()
);

alter table public.user_theme_preferences enable row level security;

drop policy if exists "user_theme_preferences_select_own" on public.user_theme_preferences;
create policy "user_theme_preferences_select_own"
  on public.user_theme_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_theme_preferences_insert_own" on public.user_theme_preferences;
create policy "user_theme_preferences_insert_own"
  on public.user_theme_preferences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_theme_preferences_update_own" on public.user_theme_preferences;
create policy "user_theme_preferences_update_own"
  on public.user_theme_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_theme_preferences_delete_own" on public.user_theme_preferences;
create policy "user_theme_preferences_delete_own"
  on public.user_theme_preferences
  for delete
  using (auth.uid() = user_id);

comment on table public.user_theme_preferences is
  'Préférence thème UI par user (registry côté code dans themes/_registry.ts). Géré par /admin/themes et /api/user/theme.';
