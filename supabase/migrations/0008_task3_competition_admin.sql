-- Task 3.0: Competition administration (match dates, club manager scope, schedule guards)

-- Scope-level match datetimes (14 rounds per scope)
create table public.competition_match_dates (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete restrict,
  scope text not null,
  region_id uuid references public.regions (id) on delete restrict,
  round int not null,
  datetime timestamptz not null,
  created_at timestamptz not null default now(),
  constraint competition_match_dates_scope_check check (scope in ('national', 'regional')),
  constraint competition_match_dates_round_check check (round between 1 and 14),
  constraint competition_match_dates_regional_region_check check (
    (scope = 'national' and region_id is null)
    or (scope = 'regional' and region_id is not null)
  )
);

create unique index competition_match_dates_scope_round_unique
  on public.competition_match_dates (season_id, scope, region_id, round)
  nulls not distinct;

create index competition_match_dates_season_id_idx
  on public.competition_match_dates (season_id);

-- Club manager assignments
create table public.club_manager_assignments (
  user_id uuid not null references auth.users (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, club_id)
);

create index club_manager_assignments_club_id_idx
  on public.club_manager_assignments (club_id);

-- RLS helpers
create or replace function public.current_user_manages_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_competition_manager()
    or exists (
      select 1
      from public.club_manager_assignments cma
      where cma.user_id = auth.uid()
        and cma.club_id = p_club_id
    );
$$;

create or replace function public.current_user_is_club_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_has_role('club_manager')
    or public.current_user_is_competition_manager();
$$;

grant execute on function public.current_user_manages_club(uuid) to authenticated;
grant execute on function public.current_user_is_club_manager() to authenticated;

-- Max matches per day per team (FR 23)
create or replace function public.enforce_max_matches_per_day_per_team()
returns trigger
language plpgsql
as $$
declare
  v_max int;
  v_home_count int;
  v_away_count int;
  v_match_day date;
begin
  select g.max_matches_per_day_per_team into v_max
  from public.groups g
  where g.id = new.group_id;

  if v_max is null then
    return new;
  end if;

  v_match_day := (new.datetime at time zone 'UTC')::date;

  select count(*) into v_home_count
  from public.matches m
  where m.group_id = new.group_id
    and m.id is distinct from new.id
    and (m.home_team_id = new.home_team_id or m.away_team_id = new.home_team_id)
    and (m.datetime at time zone 'UTC')::date = v_match_day;

  if v_home_count >= v_max then
    raise exception 'Team exceeds max_matches_per_day_per_team on this date (home/away team)';
  end if;

  select count(*) into v_away_count
  from public.matches m
  where m.group_id = new.group_id
    and m.id is distinct from new.id
    and (m.home_team_id = new.away_team_id or m.away_team_id = new.away_team_id)
    and (m.datetime at time zone 'UTC')::date = v_match_day;

  if v_away_count >= v_max then
    raise exception 'Team exceeds max_matches_per_day_per_team on this date (away team)';
  end if;

  return new;
end;
$$;

create trigger matches_max_per_day_per_team
  before insert or update on public.matches
  for each row
  execute function public.enforce_max_matches_per_day_per_team();

-- Schedule generation validation (used by Edge Function and smoke tests)
create or replace function public.validate_group_schedule_generation(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_count int;
  v_match_count int;
  v_season_id uuid;
  v_scope text;
  v_region_id uuid;
  v_date_count int;
begin
  select count(*) into v_team_count
  from public.teams t
  where t.group_id = p_group_id;

  if v_team_count <> 8 then
    raise exception 'RBBF schedule requires exactly 8 teams in group (found %)', v_team_count;
  end if;

  select count(*) into v_match_count
  from public.matches m
  where m.group_id = p_group_id;

  if v_match_count > 0 then
    raise exception 'Group already has matches; delete matches before regenerating';
  end if;

  select l.season_id, l.scope, l.region_id
  into v_season_id, v_scope, v_region_id
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where g.id = p_group_id;

  select count(*) into v_date_count
  from public.competition_match_dates cmd
  where cmd.season_id = v_season_id
    and cmd.scope = v_scope
    and cmd.region_id is not distinct from v_region_id;

  if v_date_count < 14 then
    raise exception 'Missing competition match dates (need 14, found %)', v_date_count;
  end if;
end;
$$;

grant execute on function public.validate_group_schedule_generation(uuid) to authenticated;

-- RLS: new tables
alter table public.competition_match_dates enable row level security;
alter table public.club_manager_assignments enable row level security;

create policy competition_match_dates_public_read on public.competition_match_dates
  for select to anon, authenticated using (true);

create policy competition_match_dates_manager_write on public.competition_match_dates
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy club_manager_assignments_select on public.club_manager_assignments
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_user_is_competition_manager()
  );

create policy club_manager_assignments_manager_write on public.club_manager_assignments
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

-- Club manager scoped writes on existing tables
create policy clubs_club_manager_write on public.clubs
  for all to authenticated
  using (public.current_user_manages_club(id))
  with check (public.current_user_manages_club(id));

create policy players_club_manager_write on public.players
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy player_club_memberships_club_manager_write on public.player_club_memberships
  for all to authenticated
  using (
    public.current_user_is_competition_manager()
    or public.current_user_manages_club(club_id)
  )
  with check (
    public.current_user_is_competition_manager()
    or public.current_user_manages_club(club_id)
  );

create policy teams_club_manager_write on public.teams
  for all to authenticated
  using (public.current_user_manages_club(club_id))
  with check (public.current_user_manages_club(club_id));

create policy team_players_club_manager_write on public.team_players
  for all to authenticated
  using (
    public.current_user_is_competition_manager()
    or exists (
      select 1 from public.teams t
      where t.id = team_players.team_id
        and public.current_user_manages_club(t.club_id)
    )
  )
  with check (
    public.current_user_is_competition_manager()
    or exists (
      select 1 from public.teams t
      where t.id = team_players.team_id
        and public.current_user_manages_club(t.club_id)
    )
  );
