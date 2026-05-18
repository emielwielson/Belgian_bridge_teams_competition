-- National Honor and 1st Division use separate match-date calendars; 2nd/3rd share one (division_id null).

alter table public.competition_match_dates
  add column division_id uuid references public.divisions(id) on delete restrict;

drop index if exists public.competition_match_dates_scope_round_unique;

create unique index competition_match_dates_schedule_round_unique
  on public.competition_match_dates (season_id, scope, region_id, division_id, round)
  nulls not distinct;

create or replace function public.resolve_group_match_dates_division_id(p_group_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_division_name text;
  v_division_id uuid;
begin
  select d.name, d.id into v_division_name, v_division_id
  from public.groups g
  join public.divisions d on d.id = g.division_id
  where g.id = p_group_id;

  if v_division_name in ('Honor', '1st Division') then
    return v_division_id;
  end if;

  return null;
end;
$$;

grant execute on function public.resolve_group_match_dates_division_id(uuid) to authenticated;

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

  v_dates_division_id := public.resolve_group_match_dates_division_id(p_group_id);

  select count(*) into v_date_count
  from public.competition_match_dates cmd
  where cmd.season_id = v_season_id
    and cmd.scope = v_scope
    and cmd.region_id is not distinct from v_region_id
    and cmd.division_id is not distinct from v_dates_division_id;

  if v_date_count < 14 then
    raise exception 'Missing competition match dates (need 14, found %)', v_date_count;
  end if;
end;
$$;
