-- Schedule slot ordering (spots 1–8) with optional bye for 7-team RBBF groups.

create table if not exists public.group_schedule_slots (
  group_id uuid not null references public.groups (id) on delete cascade,
  slot int not null check (slot between 1 and 8),
  team_id uuid references public.teams (id) on delete set null,
  is_bye boolean not null default false,
  primary key (group_id, slot),
  constraint group_schedule_slots_bye_no_team check (not is_bye or team_id is null)
);

create unique index if not exists group_schedule_slots_team_unique
  on public.group_schedule_slots (group_id, team_id)
  where team_id is not null;

create index if not exists group_schedule_slots_group_id_idx
  on public.group_schedule_slots (group_id);

comment on table public.group_schedule_slots is
  'RBBF template slot assignments (1–8) per group. Empty slot: is_bye=false, team_id null. Bye slot: is_bye=true.';

alter table public.group_schedule_slots enable row level security;

create policy group_schedule_slots_public_read on public.group_schedule_slots
  for select to anon, authenticated using (true);

create policy group_schedule_slots_admin_write on public.group_schedule_slots
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

grant select on public.group_schedule_slots to anon, authenticated;

-- Returns true when the group should use the fixed RBBF 8-slot template.
create or replace function public.group_uses_rbbf_template(p_group_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope text;
  v_team_count int;
  v_filled_slots int;
  v_bye_slots int;
begin
  select l.scope into v_scope
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where g.id = p_group_id;

  select count(*) into v_team_count
  from public.teams t
  where t.group_id = p_group_id;

  select
    count(*) filter (where gss.is_bye or gss.team_id is not null),
    count(*) filter (where gss.is_bye)
  into v_filled_slots, v_bye_slots
  from public.group_schedule_slots gss
  where gss.group_id = p_group_id;

  if v_scope = 'national' then
    if v_team_count not in (7, 8) then
      return false;
    end if;
    return v_filled_slots = 8 and v_bye_slots = case when v_team_count = 7 then 1 else 0 end;
  end if;

  -- Regional
  if v_team_count = 8 then
    return true;
  end if;

  if v_team_count = 7 and v_bye_slots = 1 and v_filled_slots = 8 then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.group_uses_rbbf_template(uuid) to authenticated;

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
  if public.group_uses_rbbf_template(p_group_id) then
    return;
  end if;

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
  v_filled_slots int;
  v_bye_slots int;
  v_assigned_teams int;
  v_uses_rbbf boolean;
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

  v_uses_rbbf := public.group_uses_rbbf_template(p_group_id);

  if v_uses_rbbf then
    null; -- keep configured round_count (14 or 21)
  else
    perform public.sync_group_round_count(p_group_id);
  end if;

  v_round_count := public.required_group_round_count(p_group_id);

  if v_scope = 'national' then
    if v_team_count not in (7, 8) then
      raise exception 'National schedule requires 7 or 8 teams in group (found %)', v_team_count;
    end if;
    if not v_uses_rbbf then
      if v_team_count = 7 then
        raise exception 'National group with 7 teams requires a bye slot assigned in schedule slots';
      end if;
      raise exception 'National schedule requires all 8 schedule slots to be filled';
    end if;
  else
    if v_team_count < 2 then
      raise exception 'Regional schedule requires at least 2 teams in group (found %)', v_team_count;
    end if;
    if v_team_count in (7, 8) and not v_uses_rbbf then
      select
        count(*) filter (where gss.is_bye or gss.team_id is not null),
        count(*) filter (where gss.is_bye),
        count(*) filter (where gss.team_id is not null)
      into v_filled_slots, v_bye_slots, v_assigned_teams
      from public.group_schedule_slots gss
      where gss.group_id = p_group_id;

      if v_filled_slots > 0 and v_filled_slots < 8 then
        raise exception 'Schedule slots must all be filled (found % of 8)', v_filled_slots;
      end if;
      if v_team_count = 7 and v_bye_slots = 0 and v_filled_slots = 8 then
        raise exception 'Regional group with 7 teams requires a bye slot when using RBBF template';
      end if;
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

-- Award bye VP for both regional and national RBBF-bye groups.
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
    and (p_season_id is null or l.season_id = p_season_id);

  return query select v_awarded, v_pending;
end;
$$;
