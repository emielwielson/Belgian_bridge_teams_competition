-- User UI language preference (en / nl / fr)

create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  preferred_locale text not null default 'en',
  updated_at timestamptz not null default now(),
  constraint user_profiles_preferred_locale_check check (
    preferred_locale in ('en', 'nl', 'fr')
  )
);

create index user_profiles_user_id_idx on public.user_profiles (user_id);

alter table public.user_profiles enable row level security;

create policy user_profiles_select_own on public.user_profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy user_profiles_insert_own on public.user_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_profiles_update_own on public.user_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
