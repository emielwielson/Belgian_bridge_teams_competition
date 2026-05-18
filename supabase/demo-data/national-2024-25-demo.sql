-- Demo data: 2024–25 national match dates (+ optional demo clubs/teams).
-- Run in SQL Editor after migrations through 0010 (creates national structure if missing).
-- Schedule fixtures: use Admin UI "Generate schedule" per group, or `npm run demo:national` from web/.

do $$
declare
  v_season_id uuid;
  v_league_id uuid;
  v_honor_division_id uuid;
  v_first_division_id uuid;
  v_region_id uuid;
begin
  select id into v_season_id from public.seasons where is_active = true limit 1;
  if v_season_id is null then
    raise exception 'No active season — run seed.sql first';
  end if;

  -- Ensure National league + 8 divisions + groups (idempotent)
  insert into public.leagues (season_id, scope, region_id, name)
  select v_season_id, 'national', null, 'National'
  where not exists (
    select 1 from public.leagues l
    where l.season_id = v_season_id
      and l.scope = 'national'
      and l.name = 'National'
  );

  select l.id into v_league_id
  from public.leagues l
  where l.season_id = v_season_id
    and l.scope = 'national'
    and l.name = 'National';

  insert into public.divisions (league_id, division_level_id, name)
  select v_league_id, dl.id, spec.division_name
  from (
    values
      ('Honor', 'honor'),
      ('1st Division', 'first'),
      ('2nd Division A', 'second'),
      ('2nd Division B', 'second'),
      ('3rd Division A', 'third'),
      ('3rd Division B', 'third'),
      ('3rd Division C', 'third'),
      ('3rd Division D', 'third')
  ) as spec(division_name, level_code)
  join public.division_levels dl on dl.code = spec.level_code
  where not exists (
    select 1 from public.divisions d
    where d.league_id = v_league_id and d.name = spec.division_name
  );

  insert into public.groups (division_id, name, max_matches_per_day_per_team, round_count)
  select d.id, d.name, spec.max_per_day, spec.round_count
  from public.divisions d
  cross join (
    values
      ('Honor', 3, 21),
      ('1st Division', 2, 14),
      ('2nd Division A', null::int, 14),
      ('2nd Division B', null::int, 14),
      ('3rd Division A', null::int, 14),
      ('3rd Division B', null::int, 14),
      ('3rd Division C', null::int, 14),
      ('3rd Division D', null::int, 14)
  ) as spec(division_name, max_per_day, round_count)
  where d.league_id = v_league_id
    and d.name = spec.division_name
    and not exists (
      select 1 from public.groups g
      where g.division_id = d.id and g.name = d.name
    );

  update public.groups g
  set
    max_matches_per_day_per_team = spec.max_per_day,
    round_count = spec.round_count
  from public.divisions d
  cross join (
    values
      ('Honor', 3, 21),
      ('1st Division', 2, 14),
      ('2nd Division A', null::int, 14),
      ('2nd Division B', null::int, 14),
      ('3rd Division A', null::int, 14),
      ('3rd Division B', null::int, 14),
      ('3rd Division C', null::int, 14),
      ('3rd Division D', null::int, 14)
  ) as spec(division_name, max_per_day, round_count)
  where g.division_id = d.id
    and d.league_id = v_league_id
    and d.name = spec.division_name
    and g.name = d.name;

  select d.id into v_honor_division_id
  from public.divisions d
  where d.league_id = v_league_id and d.name = 'Honor';

  select d.id into v_first_division_id
  from public.divisions d
  where d.league_id = v_league_id and d.name = '1st Division';

  if v_honor_division_id is null or v_first_division_id is null then
    raise exception 'Failed to create National divisions';
  end if;

  delete from public.competition_match_dates
  where season_id = v_season_id
    and scope = 'national'
    and region_id is null
    and (
      division_id is not distinct from v_honor_division_id
      or division_id is not distinct from v_first_division_id
      or division_id is null
    );

  -- Honor: 21 rounds on 7 days (11:00 / 13:50 / 16:40 each day)
  insert into public.competition_match_dates (season_id, scope, region_id, division_id, round, datetime)
  values
    (v_season_id, 'national', null, v_honor_division_id, 1,  ('2024-09-27 11:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 2,  ('2024-09-27 13:50'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 3,  ('2024-09-27 16:40'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 4,  ('2024-10-04 11:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 5,  ('2024-10-04 13:50'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 6,  ('2024-10-04 16:40'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 7,  ('2024-10-11 11:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 8,  ('2024-10-11 13:50'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 9,  ('2024-10-11 16:40'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 10, ('2024-10-18 11:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 11, ('2024-10-18 13:50'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 12, ('2024-10-18 16:40'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 13, ('2024-11-08 11:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 14, ('2024-11-08 13:50'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 15, ('2024-11-08 16:40'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 16, ('2024-11-22 11:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 17, ('2024-11-22 13:50'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 18, ('2024-11-22 16:40'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 19, ('2024-11-29 11:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 20, ('2024-11-29 13:50'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_honor_division_id, 21, ('2024-11-29 16:40'::timestamp at time zone 'Europe/Brussels'));

  -- 1st Division: 14 rounds on 7 days (13:00 / 16:00 each day)
  insert into public.competition_match_dates (season_id, scope, region_id, division_id, round, datetime)
  values
    (v_season_id, 'national', null, v_first_division_id, 1,  ('2024-09-27 13:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 2,  ('2024-09-27 16:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 3,  ('2024-10-04 13:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 4,  ('2024-10-04 16:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 5,  ('2024-10-11 13:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 6,  ('2024-10-11 16:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 7,  ('2024-10-18 13:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 8,  ('2024-10-18 16:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 9,  ('2024-11-08 13:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 10, ('2024-11-08 16:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 11, ('2024-11-22 13:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 12, ('2024-11-22 16:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 13, ('2024-11-29 13:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, v_first_division_id, 14, ('2024-11-29 16:00'::timestamp at time zone 'Europe/Brussels'));

  -- 2nd & 3rd divisions (shared calendar)
  insert into public.competition_match_dates (season_id, scope, region_id, division_id, round, datetime)
  values
    (v_season_id, 'national', null, null, 1,  ('2024-09-27 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 2,  ('2024-10-04 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 3,  ('2024-10-11 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 4,  ('2024-10-18 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 5,  ('2024-11-08 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 6,  ('2024-11-15 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 7,  ('2024-11-22 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 8,  ('2024-12-06 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 9,  ('2024-12-13 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 10, ('2025-01-17 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 11, ('2025-01-24 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 12, ('2025-01-31 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 13, ('2025-02-14 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'national', null, null, 14, ('2025-02-28 14:00'::timestamp at time zone 'Europe/Brussels'));

  -- Demo clubs (8) and 8 teams per national group
  select id into v_region_id from public.regions where code = 'flanders' limit 1;

  insert into public.clubs (name, region_id)
  select 'Demo Club ' || i, v_region_id
  from generate_series(1, 8) as i
  where not exists (
    select 1 from public.clubs c where c.name = 'Demo Club ' || i
  );

  insert into public.teams (group_id, club_id, name)
  select g.id, c.id, c.name || ' — ' || g.name
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  cross join lateral (
    select id, name
    from public.clubs
    where name like 'Demo Club %'
    order by name
    limit 8
  ) c
  where l.season_id = v_season_id
    and l.scope = 'national'
    and l.name = 'National'
    and not exists (
      select 1 from public.teams t where t.group_id = g.id
    )
  order by g.name, c.name;
end $$;

select 'national-2024-25-demo loaded (dates + demo teams; generate schedules via Admin or npm run demo:national)' as result;
