-- Regional round-robin configuration, bye VP tracking, and flexible schedule validation.

alter table public.groups
  add column if not exists round_robin_count int not null default 2;

alter table public.groups
  drop constraint if exists groups_round_robin_count_check;

alter table public.groups
  add constraint groups_round_robin_count_check check (round_robin_count >= 1);

alter table public.groups
  drop constraint if exists groups_round_count_check;

alter table public.groups
  add constraint groups_round_count_check check (round_count between 1 and 42);

comment on column public.groups.round_robin_count is
  'Number of full round-robin cycles (regional groups). Total rounds = roundsPerCycle(teamCount) × round_robin_count.';

create table if not exists public.group_bye_rounds (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  round int not null,
  team_id uuid not null references public.teams (id) on delete cascade,
  vp numeric not null default 12,
  awarded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint group_bye_rounds_round_check check (round >= 1),
  constraint group_bye_rounds_vp_check check (vp >= 0),
  constraint group_bye_rounds_group_round_unique unique (group_id, round)
);

create index if not exists group_bye_rounds_group_id_idx
  on public.group_bye_rounds (group_id);

create index if not exists group_bye_rounds_pending_idx
  on public.group_bye_rounds (awarded_at)
  where awarded_at is null;

comment on table public.group_bye_rounds is
  'Resting team per round for odd-sized regional groups; 12 VP awarded via award-bye-scores after match date.';

alter table public.group_bye_rounds enable row level security;

create policy group_bye_rounds_public_read on public.group_bye_rounds
  for select to anon, authenticated using (true);

create policy group_bye_rounds_admin_write on public.group_bye_rounds
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

grant select on public.group_bye_rounds to anon, authenticated;

create or replace function public.rounds_per_cycle(p_team_count int)
returns int
language sql
immutable
as $$
  select case
    when p_team_count < 2 then 0
    when p_team_count % 2 = 1 then p_team_count
    else p_team_count - 1
  end;
$$;

create or replace function public.compute_group_round_count(
  p_team_count int,
  p_round_robin_count int
)
returns int
language sql
immutable
as $$
  select public.rounds_per_cycle(p_team_count) * greatest(p_round_robin_count, 1);
$$;

create or replace function public.sync_group_round_count(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_count int;
  v_round_robin_count int;
begin
  select count(*) into v_team_count
  from public.teams t
  where t.group_id = p_group_id;

  select g.round_robin_count into v_round_robin_count
  from public.groups g
  where g.id = p_group_id;

  update public.groups g
  set round_count = public.compute_group_round_count(
    v_team_count,
    coalesce(v_round_robin_count, 2)
  )
  where g.id = p_group_id;
end;
$$;

grant execute on function public.sync_group_round_count(uuid) to authenticated;

create or replace function public.validate_group_schedule_generation(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_count int;
  v_match_count int;
  v_bye_count int;
  v_season_id uuid;
  v_scope text;
  v_region_id uuid;
  v_dates_division_id uuid;
  v_date_count int;
  v_round_count int;
begin
  select count(*) into v_team_count
  from public.teams t
  where t.group_id = p_group_id;

  select count(*) into v_match_count
  from public.matches m
  where m.group_id = p_group_id;

  select count(*) into v_bye_count
  from public.group_bye_rounds gbr
  where gbr.group_id = p_group_id;

  if v_match_count > 0 or v_bye_count > 0 then
    raise exception 'Group already has a schedule; delete matches and bye rows before regenerating';
  end if;

  select l.season_id, l.scope, l.region_id
  into v_season_id, v_scope, v_region_id
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where g.id = p_group_id;

  perform public.sync_group_round_count(p_group_id);
  v_round_count := public.required_group_round_count(p_group_id);

  if v_scope = 'national' then
    if v_team_count <> 8 then
      raise exception 'National schedule requires exactly 8 teams in group (found %)', v_team_count;
    end if;
  else
    if v_team_count < 2 then
      raise exception 'Regional schedule requires at least 2 teams in group (found %)', v_team_count;
    end if;
  end if;

  v_dates_division_id := public.resolve_group_match_dates_division_id(p_group_id);

  select count(*) into v_date_count
  from public.competition_match_dates cmd
  where cmd.season_id = v_season_id
    and cmd.scope = v_scope
    and cmd.region_id is not distinct from v_region_id
    and cmd.division_id is not distinct from v_dates_division_id;

  if v_date_count < v_round_count then
    raise exception 'Missing competition match dates (need %, found %)', v_round_count, v_date_count;
  end if;
end;
$$;

-- Standings: include awarded bye VP (regional odd groups)
create or replace view public.standings_group as
with match_vp as (
  select
    m.group_id,
    m.home_team_id as team_id,
    coalesce(m.vp_home, 0) as vp
  from public.matches m
  where m.played_at is not null
  union all
  select
    m.group_id,
    m.away_team_id as team_id,
    coalesce(m.vp_away, 0) as vp
  from public.matches m
  where m.played_at is not null
  union all
  select
    gbr.group_id,
    gbr.team_id,
    gbr.vp
  from public.group_bye_rounds gbr
  where gbr.awarded_at is not null
),
match_totals as (
  select group_id, team_id, sum(vp) as match_vp_total
  from match_vp
  group by group_id, team_id
),
penalty_totals as (
  select
    t.group_id,
    p.team_id,
    coalesce(sum(p.vp_deduction), 0) as penalty_vp
  from public.penalties p
  join public.teams t on t.id = p.team_id
  group by t.group_id, p.team_id
)
select
  t.group_id,
  t.id as team_id,
  t.name as team_name,
  coalesce(mt.match_vp_total, 0) - coalesce(pt.penalty_vp, 0) as vp_total
from public.teams t
left join match_totals mt on mt.team_id = t.id and mt.group_id = t.group_id
left join penalty_totals pt on pt.team_id = t.id and pt.group_id = t.group_id;

create or replace function public.award_due_bye_scores(p_season_id uuid default null)
returns table (awarded int, pending int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awarded int := 0;
  v_pending int := 0;
begin
  with due as (
    select gbr.id
    from public.group_bye_rounds gbr
    join public.groups g on g.id = gbr.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    join public.competition_match_dates cmd on
      cmd.season_id = l.season_id
      and cmd.scope = l.scope
      and cmd.region_id is not distinct from l.region_id
      and cmd.division_id is not distinct from public.resolve_group_match_dates_division_id(g.id)
      and cmd.round = gbr.round
    where gbr.awarded_at is null
      and l.scope = 'regional'
      and cmd.datetime <= now()
      and (p_season_id is null or l.season_id = p_season_id)
  ),
  updated as (
    update public.group_bye_rounds gbr
    set awarded_at = now()
    from due
    where gbr.id = due.id
    returning gbr.id
  )
  select count(*)::int into v_awarded from updated;

  select count(*)::int into v_pending
  from public.group_bye_rounds gbr
  join public.groups g on g.id = gbr.group_id
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where gbr.awarded_at is null
    and l.scope = 'regional'
    and (p_season_id is null or l.season_id = p_season_id);

  return query select v_awarded, v_pending;
end;
$$;

grant execute on function public.award_due_bye_scores(uuid) to service_role;
