-- Honor division: 21 rounds (triple round-robin); others remain 14.

alter table public.competition_match_dates
  drop constraint if exists competition_match_dates_round_check;

alter table public.competition_match_dates
  add constraint competition_match_dates_round_check check (round between 1 and 21);

alter table public.groups
  add column if not exists round_count int not null default 14;

alter table public.groups
  drop constraint if exists groups_round_count_check;

alter table public.groups
  add constraint groups_round_count_check check (round_count in (14, 21));

comment on column public.groups.round_count is
  'Fixture rounds for this group (14 = double RR, 21 = triple RR for Honor).';

-- Honor groups in National league
update public.groups g
set round_count = 21
from public.divisions d
join public.leagues l on l.id = d.league_id
where g.division_id = d.id
  and d.name = 'Honor'
  and l.scope = 'national'
  and l.name = 'National';

create or replace function public.required_group_round_count(p_group_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(g.round_count, 14)
  from public.groups g
  where g.id = p_group_id;
$$;

grant execute on function public.required_group_round_count(uuid) to authenticated;

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
  v_dates_division_id uuid;
  v_date_count int;
  v_round_count int;
begin
  v_round_count := public.required_group_round_count(p_group_id);

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
