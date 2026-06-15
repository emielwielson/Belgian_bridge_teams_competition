-- Shared email + multi-player profile auth

-- 1. Allow duplicate player contact emails
alter table public.players drop constraint if exists players_email_unique;

-- 2. Auth link table (many players per auth user)
create table public.player_auth_links (
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (auth_user_id, player_id)
);

create index player_auth_links_player_id_idx on public.player_auth_links (player_id);

-- 3. Active player on user profile
alter table public.user_profiles
  add column if not exists active_player_id uuid references public.players (id) on delete set null;

-- 4. Backfill from legacy players.auth_user_id
insert into public.player_auth_links (auth_user_id, player_id)
select p.auth_user_id, p.id
from public.players p
where p.auth_user_id is not null
on conflict do nothing;

insert into public.user_profiles (user_id, preferred_locale, active_player_id)
select pal.auth_user_id, 'en', pal.player_id
from public.player_auth_links pal
where (
  select count(*)
  from public.player_auth_links pal2
  where pal2.auth_user_id = pal.auth_user_id
) = 1
on conflict (user_id) do update
set active_player_id = excluded.active_player_id
where public.user_profiles.active_player_id is null;

-- 5. Drop legacy column
drop index if exists public.players_auth_user_id_unique;
alter table public.players drop column if exists auth_user_id;

-- 6. SQL helpers
create or replace function public.sync_player_auth_links()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select lower(trim(u.email))
  into v_email
  from auth.users u
  where u.id = auth.uid();

  if v_email is null or v_email = '' then
    return;
  end if;

  insert into public.player_auth_links (auth_user_id, player_id)
  select auth.uid(), p.id
  from public.players p
  where p.email is not null
    and lower(trim(p.email)) = v_email
  on conflict do nothing;
end;
$$;

create or replace function public.set_active_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.player_auth_links pal
    where pal.auth_user_id = auth.uid()
      and pal.player_id = p_player_id
  ) then
    raise exception 'Player is not linked to this account';
  end if;

  insert into public.user_profiles (user_id, preferred_locale, active_player_id)
  values (auth.uid(), 'en', p_player_id)
  on conflict (user_id) do update
  set active_player_id = excluded.active_player_id,
      updated_at = now();
end;
$$;

create or replace function public.current_user_player_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select up.active_player_id
  from public.user_profiles up
  join public.player_auth_links pal
    on pal.player_id = up.active_player_id
   and pal.auth_user_id = auth.uid()
  where up.user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.sync_player_auth_links() to authenticated;
grant execute on function public.set_active_player(uuid) to authenticated;

-- 7. RLS on player_auth_links
alter table public.player_auth_links enable row level security;

create policy player_auth_links_select_own on public.player_auth_links
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy player_auth_links_insert_own on public.player_auth_links
  for insert to authenticated
  with check (
    auth_user_id = auth.uid()
    and (
      public.current_user_is_competition_manager()
      or exists (
        select 1
        from public.players p
        join auth.users u on u.id = auth.uid()
        where p.id = player_id
          and p.email is not null
          and lower(trim(p.email)) = lower(trim(u.email))
      )
    )
  );

create policy player_auth_links_delete_own on public.player_auth_links
  for delete to authenticated
  using (
    auth_user_id = auth.uid()
    and public.current_user_is_competition_manager()
  );

create policy player_auth_links_manager_all on public.player_auth_links
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());
