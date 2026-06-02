-- RBBF groups must use 14 or 21 fixture rounds; generic sync left stale values (e.g. 12).

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
    select g.round_robin_count into v_round_robin_count
    from public.groups g
    where g.id = p_group_id;

    update public.groups g
    set round_count = case
      when coalesce(v_round_robin_count, 2) >= 3 then 21
      else 14
    end
    where g.id = p_group_id;
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

-- Re-sync RBBF groups that still have a generic round-robin count (e.g. 12).
update public.groups g
set round_count = case
  when coalesce(g.round_robin_count, 2) >= 3 then 21
  else 14
end
where public.group_uses_rbbf_template(g.id)
  and g.round_count not in (14, 21);

-- Always sync before validation so RBBF groups get 14/21, not a stale generic count.
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
  v_used_rounds int[];
  v_regional_dates_required int := 14;
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

  perform public.sync_group_round_count(p_group_id);

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

  if v_scope = 'regional' then
    if v_date_count < v_regional_dates_required then
      raise exception 'Missing regional competition match dates (need %, found %)',
        v_regional_dates_required, v_date_count;
    end if;
    if v_round_count < 14 then
      v_used_rounds := public.group_used_match_rounds(p_group_id);
      if coalesce(array_length(v_used_rounds, 1), 0) <> v_round_count then
        raise exception 'Group match round selection invalid for % fixture rounds', v_round_count;
      end if;
    end if;
  else
    if v_date_count < v_round_count then
      raise exception 'Missing competition match dates (need %, found %)', v_round_count, v_date_count;
    end if;
  end if;
end;
$$;
