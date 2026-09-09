-- Stable competition kinds + optional per-manager scopes.
-- Legacy: competition_manager with zero scope rows remains global.
-- system_admin is always global.

create table public.competition_kinds (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint competition_kinds_code_unique unique (code)
);

insert into public.competition_kinds (code, name) values
  ('national', 'National'),
  ('flanders', 'Flanders'),
  ('wallonia', 'Wallonia');

alter table public.leagues
  add column competition_kind_id uuid references public.competition_kinds (id) on delete restrict;

update public.leagues l
set competition_kind_id = ck.id
from public.competition_kinds ck
where l.scope = 'national'
  and l.region_id is null
  and ck.code = 'national';

update public.leagues l
set competition_kind_id = ck.id
from public.regions r
join public.competition_kinds ck on ck.code = r.code
where l.scope = 'regional'
  and l.region_id = r.id;

alter table public.leagues
  alter column competition_kind_id set not null;

create index leagues_competition_kind_id_idx on public.leagues (competition_kind_id);

create table public.competition_manager_scopes (
  user_id uuid not null references auth.users (id) on delete cascade,
  competition_kind_id uuid not null references public.competition_kinds (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, competition_kind_id)
);

create index competition_manager_scopes_user_id_idx
  on public.competition_manager_scopes (user_id);

alter table public.competition_kinds enable row level security;
alter table public.competition_manager_scopes enable row level security;

create policy competition_kinds_select on public.competition_kinds
  for select to anon, authenticated
  using (true);

create policy competition_kinds_admin_write on public.competition_kinds
  for all to authenticated
  using (public.current_user_is_system_admin())
  with check (public.current_user_is_system_admin());

create policy competition_manager_scopes_select_own on public.competition_manager_scopes
  for select to authenticated
  using (user_id = auth.uid() or public.current_user_is_system_admin());

create policy competition_manager_scopes_admin_write on public.competition_manager_scopes
  for all to authenticated
  using (public.current_user_is_system_admin())
  with check (public.current_user_is_system_admin());

-- True when the current user may manage the given competition kind.
create or replace function public.current_user_manages_competition_kind(p_kind_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_is_system_admin()
    or (
      public.current_user_has_role('competition_manager')
      and (
        not exists (
          select 1
          from public.competition_manager_scopes cms
          where cms.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.competition_manager_scopes cms
          where cms.user_id = auth.uid()
            and cms.competition_kind_id = p_kind_id
        )
      )
    );
$$;

create or replace function public.current_user_manages_league(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and public.current_user_manages_competition_kind(l.competition_kind_id)
  );
$$;

create or replace function public.current_user_manages_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    join public.divisions d on d.id = g.division_id
    where g.id = p_group_id
      and public.current_user_manages_league(d.league_id)
  );
$$;

create or replace function public.current_user_manages_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and public.current_user_manages_group(m.group_id)
  );
$$;

create or replace function public.current_user_manages_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = p_team_id
      and public.current_user_manages_group(t.group_id)
  );
$$;

-- Clubs are regional: map region.code → competition_kinds.code.
create or replace function public.current_user_manages_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clubs c
    join public.regions r on r.id = c.region_id
    join public.competition_kinds ck on ck.code = r.code
    where c.id = p_club_id
      and public.current_user_manages_competition_kind(ck.id)
  );
$$;

-- Map competition_match_dates / admin unit (scope + region_id) to a kind.
create or replace function public.current_user_manages_competition_unit(
  p_scope text,
  p_region_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.competition_kinds ck
    left join public.regions r on r.id = p_region_id
    where public.current_user_manages_competition_kind(ck.id)
      and (
        (p_scope = 'national' and p_region_id is null and ck.code = 'national')
        or (
          p_scope = 'regional'
          and p_region_id is not null
          and ck.code = r.code
        )
      )
  );
$$;

grant execute on function public.current_user_manages_competition_kind(uuid) to anon, authenticated;
grant execute on function public.current_user_manages_league(uuid) to anon, authenticated;
grant execute on function public.current_user_manages_group(uuid) to anon, authenticated;
grant execute on function public.current_user_manages_match(uuid) to anon, authenticated;
grant execute on function public.current_user_manages_team(uuid) to anon, authenticated;
grant execute on function public.current_user_manages_club(uuid) to anon, authenticated;
grant execute on function public.current_user_manages_competition_unit(text, uuid) to anon, authenticated;

grant select on public.competition_kinds to anon, authenticated;
grant select on public.competition_manager_scopes to authenticated;
