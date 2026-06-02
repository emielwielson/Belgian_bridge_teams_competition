-- Per-group skipped regional calendar rounds (shared 14-date region calendar).

create table if not exists public.group_skipped_match_rounds (
  group_id uuid not null references public.groups (id) on delete cascade,
  round int not null check (round between 1 and 14),
  primary key (group_id, round)
);

create index if not exists group_skipped_match_rounds_group_id_idx
  on public.group_skipped_match_rounds (group_id);

comment on table public.group_skipped_match_rounds is
  'Regional calendar rounds (1–14) skipped for this group. Empty = default trailing skips.';

alter table public.group_skipped_match_rounds enable row level security;

create policy group_skipped_match_rounds_public_read on public.group_skipped_match_rounds
  for select to anon, authenticated using (true);

create policy group_skipped_match_rounds_admin_write on public.group_skipped_match_rounds
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

grant select on public.group_skipped_match_rounds to anon, authenticated;

-- Sorted calendar rounds used for fixtures (stores values written to matches.round).
create or replace function public.group_used_match_rounds(p_group_id uuid)
returns int[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_round_count int;
  v_uses_rbbf boolean;
  v_scope text;
  v_custom_skips int;
  v_used int[];
  v_i int;
begin
  v_round_count := public.required_group_round_count(p_group_id);
  v_uses_rbbf := public.group_uses_rbbf_template(p_group_id);

  select l.scope into v_scope
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where g.id = p_group_id;

  if v_scope = 'national' or v_uses_rbbf or v_round_count >= 14 then
    v_used := array[]::int[];
    for v_i in 1..least(v_round_count, 14) loop
      v_used := array_append(v_used, v_i);
    end loop;
    return v_used;
  end if;

  select count(*) into v_custom_skips
  from public.group_skipped_match_rounds gsmr
  where gsmr.group_id = p_group_id;

  if v_custom_skips = 0 then
    v_used := array[]::int[];
    for v_i in 1..v_round_count loop
      v_used := array_append(v_used, v_i);
    end loop;
    return v_used;
  end if;

  select coalesce(array_agg(r order by r), array[]::int[])
  into v_used
  from generate_series(1, 14) as r
  where r not in (
    select gsmr.round
    from public.group_skipped_match_rounds gsmr
    where gsmr.group_id = p_group_id
  );

  if coalesce(array_length(v_used, 1), 0) <> v_round_count then
    raise exception 'Group match round selection invalid: need % used rounds, found %',
      v_round_count, coalesce(array_length(v_used, 1), 0);
  end if;

  return v_used;
end;
$$;

grant execute on function public.group_used_match_rounds(uuid) to authenticated;

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

  if v_uses_rbbf then
    null;
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
