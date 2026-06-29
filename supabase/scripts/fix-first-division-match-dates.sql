-- Rebuild 1st Division national match dates (stack leg N with mirror N+7 per day).
-- Run in Supabase SQL editor as postgres.
--
-- Fixes calendars where consecutive first-leg rounds were placed on the same day,
-- causing 4 matches per team per day and tripping max_matches_per_day_per_team.
--
-- After running: POST /api/admin/competition/groups/<group_id>/generate

do $$
declare
  v_season_id uuid;
  v_division_id uuid;
  v_group_id uuid;
  v_match_days date[] := array[]::date[];
  v_day date;
  v_day_index int;
  v_slot_index int;
  v_round int;
  v_slot_times text[] := array['13:00', '16:00'];
  v_unique_count int;
  v_last_day date;
begin
  select s.id into v_season_id
  from public.seasons s
  where s.is_active = true
  limit 1;

  if v_season_id is null then
    raise exception 'No active season found';
  end if;

  select d.id into v_division_id
  from public.divisions d
  join public.leagues l on l.id = d.league_id
  where l.season_id = v_season_id
    and l.scope = 'national'
    and d.name = '1st Division'
  limit 1;

  if v_division_id is null then
    raise exception '1st Division not found for active national season';
  end if;

  select g.id into v_group_id
  from public.groups g
  where g.division_id = v_division_id
  limit 1;

  -- Prefer one Brussels date per first-leg round (1–7), in round order.
  for v_round in 1..7 loop
    select (cmd.datetime at time zone 'Europe/Brussels')::date
    into v_day
    from public.competition_match_dates cmd
    where cmd.season_id = v_season_id
      and cmd.scope = 'national'
      and cmd.division_id = v_division_id
      and cmd.round = v_round;

    if v_day is null then
      raise exception 'Missing competition_match_dates for round %', v_round;
    end if;

    v_match_days := array_append(v_match_days, v_day);
  end loop;

  -- 1st Division needs 7 distinct match days. If the calendar was saved with the
  -- old consecutive-round mapping, rounds 1–2 (etc.) share dates — dedupe in order
  -- and extend with +14 day intervals from the last known day.
  select count(distinct d) into v_unique_count from unnest(v_match_days) as d;

  if v_unique_count < 7 then
    v_match_days := array[]::date[];

    for v_day in
      select leg.d
      from (
        select
          (cmd.datetime at time zone 'Europe/Brussels')::date as d,
          min(cmd.round) as ord
        from public.competition_match_dates cmd
        where cmd.season_id = v_season_id
          and cmd.scope = 'national'
          and cmd.division_id = v_division_id
          and cmd.round between 1 and 7
        group by 1
        order by min(cmd.round)
      ) leg
    loop
      v_match_days := array_append(v_match_days, v_day);
    end loop;

    v_last_day := v_match_days[array_length(v_match_days, 1)];

    while array_length(v_match_days, 1) < 7 loop
      v_last_day := v_last_day + interval '14 days';
      v_match_days := array_append(v_match_days, v_last_day::date);
    end loop;
  end if;

  -- Ensure 7 unique days (required for 2 matches/team/day with stacked legs).
  if (select count(distinct d) from unnest(v_match_days) as d) < 7 then
    raise exception
      'Need 7 distinct match days for 1st Division; edit v_match_days in this script manually. Current: %',
      v_match_days;
  end if;

  raise notice '1st Division match days: %', v_match_days;

  delete from public.competition_match_dates
  where season_id = v_season_id
    and scope = 'national'
    and division_id = v_division_id;

  for v_day_index in 0..6 loop
    for v_slot_index in 0..1 loop
      v_round := v_day_index + 1 + v_slot_index * 7;

      insert into public.competition_match_dates (
        season_id,
        scope,
        region_id,
        division_id,
        round,
        datetime
      )
      values (
        v_season_id,
        'national',
        null,
        v_division_id,
        v_round,
        (v_match_days[v_day_index + 1]::text || ' ' || v_slot_times[v_slot_index + 1])::timestamp
          at time zone 'Europe/Brussels'
      );
    end loop;
  end loop;

  update public.groups
  set max_matches_per_day_per_team = 2
  where id = v_group_id;

  if v_group_id is not null then
    alter table public.matches disable trigger matches_block_delete_active;

    delete from public.rulings r
    using public.matches m
    where r.match_id = m.id
      and m.group_id = v_group_id;

    delete from public.group_bye_rounds
    where group_id = v_group_id;

    delete from public.matches
    where group_id = v_group_id;

    alter table public.matches enable trigger matches_block_delete_active;

    raise notice 'Cleared fixtures for group %', v_group_id;
  end if;

  raise notice 'Done. Regenerate fixtures for group %', v_group_id;
  raise notice 'After deploy: POST /api/admin/competition/groups/%/revalidate to refresh standings links', v_group_id;
end;
$$;

-- Verify: each Brussels date should appear exactly twice (rounds N and N+7).
select
  cmd.round,
  cmd.datetime,
  (cmd.datetime at time zone 'Europe/Brussels')::date as brussels_date,
  count(*) over (
    partition by (cmd.datetime at time zone 'Europe/Brussels')::date
  ) as rounds_on_day
from public.competition_match_dates cmd
join public.divisions d on d.id = cmd.division_id
join public.leagues l on l.id = d.league_id
join public.seasons s on s.id = l.season_id
where s.is_active = true
  and d.name = '1st Division'
  and cmd.scope = 'national'
order by cmd.round;
