-- Demo data: 2024–25 national competition (wipe + reload).
-- Run in SQL Editor after migrations through 0013.
-- Removes national matches, teams, and match calendars for the active season, then recreates
-- structure, dates, demo clubs/teams, rosters (4 players per team), and extra unassigned club players.
-- Schedules: Admin UI or `npm run demo:national` from web/.

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

  -- Reset national demo data for this season (safe if National league does not exist yet)
  delete from public.rulings r
  where r.match_id in (
    select m.id
    from public.matches m
    join public.groups g on g.id = m.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'national'
  );

  delete from public.matches m
  using public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where m.group_id = g.id
    and l.season_id = v_season_id
    and l.scope = 'national';

  delete from public.team_players tp
  where tp.team_id in (
    select t.id
    from public.teams t
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'national'
  );

  update public.teams t
  set captain_id = null
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  join public.clubs c on c.id = t.club_id
  where t.group_id = g.id
    and l.season_id = v_season_id
    and l.scope = 'national'


  delete from public.player_club_memberships pcm
  using public.players p
  where pcm.player_id = p.id
    and pcm.season_id = v_season_id
    and p.member_number ~ '^DEMO-(C|N)[0-9]+-P[0-9]+$';

  delete from public.players p
  where p.member_number ~ '^DEMO-(C|N)[0-9]+-P[0-9]+$';

  delete from public.penalties p
  where p.team_id in (
    select t.id
    from public.teams t
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'national'
  );

  delete from public.warnings w
  where w.team_id in (
    select t.id
    from public.teams t
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'national'
  );

  delete from public.teams t
  using public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where t.group_id = g.id
    and l.season_id = v_season_id
    and l.scope = 'national';

  -- Stray national groups (VP/VM template test groups, legacy duplicate "Honor" group)
  delete from public.rulings r
  where r.match_id in (
    select m.id
    from public.matches m
    join public.groups g on g.id = m.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'national'
      and (
        g.name ilike '%template%group%'
        or g.name in ('VP Template Group', 'VM Template Group')
        or (
          g.name = 'Honor'
          and exists (
            select 1
            from public.divisions d2
            where d2.league_id = l.id
              and d2.name = 'Honor Division'
          )
        )
      )
  );

  delete from public.matches m
  using public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where m.group_id = g.id
    and l.season_id = v_season_id
    and l.scope = 'national'
    and (
      g.name ilike '%template%group%'
      or g.name in ('VP Template Group', 'VM Template Group')
      or (
        g.name = 'Honor'
        and exists (
          select 1
          from public.divisions d2
          where d2.league_id = l.id
            and d2.name = 'Honor Division'
        )
      )
    );

  delete from public.vp_table_rows vtr
  using public.vp_tables vt
  join public.groups g on g.id = vt.group_id
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where vtr.vp_table_id = vt.id
    and l.season_id = v_season_id
    and l.scope = 'national'
    and (
      g.name ilike '%template%group%'
      or g.name in ('VP Template Group', 'VM Template Group')
      or (
        g.name = 'Honor'
        and exists (
          select 1
          from public.divisions d2
          where d2.league_id = l.id
            and d2.name = 'Honor Division'
        )
      )
    );

  delete from public.vp_tables vt
  using public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where vt.group_id = g.id
    and l.season_id = v_season_id
    and l.scope = 'national'
    and (
      g.name ilike '%template%group%'
      or g.name in ('VP Template Group', 'VM Template Group')
      or (
        g.name = 'Honor'
        and exists (
          select 1
          from public.divisions d2
          where d2.league_id = l.id
            and d2.name = 'Honor Division'
        )
      )
    );

  delete from public.groups g
  using public.divisions d
  join public.leagues l on l.id = d.league_id
  where g.division_id = d.id
    and l.season_id = v_season_id
    and l.scope = 'national'
    and (
      g.name ilike '%template%group%'
      or g.name in ('VP Template Group', 'VM Template Group')
      or (
        g.name = 'Honor'
        and exists (
          select 1
          from public.divisions d2
          where d2.league_id = l.id
            and d2.name = 'Honor Division'
        )
      )
    );

  update public.divisions d
  set name = 'Honor Division'
  from public.leagues l
  where d.league_id = l.id
    and l.season_id = v_season_id
    and l.scope = 'national'
    and d.name = 'Honor';

  update public.groups g
  set name = 'Honor Division'
  from public.divisions d
  join public.leagues l on l.id = d.league_id
  where g.division_id = d.id
    and l.season_id = v_season_id
    and l.scope = 'national'
    and g.name = 'Honor'
    and d.name = 'Honor Division';

  delete from public.competition_match_dates
  where season_id = v_season_id
    and scope = 'national'
    and region_id is null;

  -- Ensure National league + 8 divisions + groups (idempotent)
  insert into public.leagues (season_id, scope, region_id, name)
  select v_season_id, 'national', null, 'National'
  where not exists (
    select 1 from public.leagues l
    where l.season_id = v_season_id
      and l.scope = 'national'
  );

  select l.id into v_league_id
  from public.leagues l
  where l.season_id = v_season_id
    and l.scope = 'national'
  limit 1;

  insert into public.divisions (league_id, division_level_id, name)
  select v_league_id, dl.id, spec.division_name
  from (
    values
      ('Honor Division', 'honor'),
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
      ('Honor Division', 3, 21),
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
      ('Honor Division', 3, 21),
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
  where d.league_id = v_league_id and d.name = 'Honor Division';

  select d.id into v_first_division_id
  from public.divisions d
  where d.league_id = v_league_id and d.name = '1st Division';

  if v_honor_division_id is null or v_first_division_id is null then
    raise exception 'Failed to create National divisions';
  end if;

  -- Honor Division: 21 rounds on 7 days (11:00 / 13:50 / 16:40 each day)
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

  -- Clubs and teams from last season (see demo-national-data.ts)
  select id into v_region_id from public.regions where code = 'flanders' limit 1;

  create temp table national_demo_teams (
    division_name text not null,
    team_name text not null
  ) on commit drop;

  insert into national_demo_teams (division_name, team_name)
  values
    ('Honor Division', 'Riviera 121'),
    ('Honor Division', 'BBC 321'),
    ('Honor Division', 'BBC 121'),
    ('Honor Division', 'BBC 221'),
    ('Honor Division', 'UAE 121'),
    ('Honor Division', 'BBC 421'),
    ('Honor Division', 'Cercle-Perron 121'),
    ('Honor Division', 'Pieterman 121'),
    ('1st Division', 'Riviera 214'),
    ('1st Division', 'Sandeman 114'),
    ('1st Division', 'Riviera 314'),
    ('1st Division', 'Cercle-Perron 214'),
    ('1st Division', 'Squeeze 114'),
    ('1st Division', 'BBC 514'),
    ('1st Division', 'UAE 214'),
    ('1st Division', 'Genk 114'),
    ('2nd Division A', 'Pieterman 214'),
    ('2nd Division A', 'Cercle-Perron 314'),
    ('2nd Division A', 'Waregem 114'),
    ('2nd Division A', 'Charleroi 114'),
    ('2nd Division A', 'Riviera 414'),
    ('2nd Division A', 'Forum 114'),
    ('2nd Division A', 'Squeeze 214'),
    ('2nd Division A', 'Westrand 114'),
    ('2nd Division B', 'Boeckenberg 114'),
    ('2nd Division B', 'Cercle-Perron 414'),
    ('2nd Division B', 'Cercle-Perron 514'),
    ('2nd Division B', 'Lier 114'),
    ('2nd Division B', 'DUA 114'),
    ('2nd Division B', 'Geel 114'),
    ('2nd Division B', 'Riviera 514'),
    ('2nd Division B', 'Verviers 114'),
    ('3rd Division A', 'Knokke 114'),
    ('3rd Division A', 'Witte Beer 214'),
    ('3rd Division A', 'Forum 214'),
    ('3rd Division A', 'Waasmunster 114'),
    ('3rd Division A', 'Witte Beer 114'),
    ('3rd Division A', 'Bridgeclub Roeselare 114'),
    ('3rd Division A', 'Eeklo 114'),
    ('3rd Division A', 'Westrand 214'),
    ('3rd Division B', 'Argayon 114'),
    ('3rd Division B', 'Sandeman 214'),
    ('3rd Division B', 'Pieterman 314'),
    ('3rd Division B', 'Namur 214'),
    ('3rd Division B', 'UAE 314'),
    ('3rd Division B', 'Wilg & Donk 114'),
    ('3rd Division B', 'Riviera 614'),
    ('3rd Division B', 'BBC 814'),
    ('3rd Division C', 'Namur 114'),
    ('3rd Division C', 'BBC 614'),
    ('3rd Division C', 'Cercle-Perron 614'),
    ('3rd Division C', 'Charleroi 214'),
    ('3rd Division C', 'Cercle-Perron 714'),
    ('3rd Division C', 'B.C. Mons 114'),
    ('3rd Division C', 'Smohain 114'),
    ('3rd Division C', 'BBC 914'),
    ('3rd Division D', 'BBC 714'),
    ('3rd Division D', 'Lier 214'),
    ('3rd Division D', 'Pieterman 414'),
    ('3rd Division D', 'Cercle-Perron 814'),
    ('3rd Division D', 'Zennebridge 114'),
    ('3rd Division D', 'Aarschot 114'),
    ('3rd Division D', 'Retiese 114'),
    ('3rd Division D', 'Riviera 714');

  insert into public.clubs (name, region_id)
  select distinct
    regexp_replace(ndt.team_name, '\s+\d{3}$', ''),
    v_region_id
  from national_demo_teams ndt
  where not exists (
    select 1
    from public.clubs c
    where c.name = regexp_replace(ndt.team_name, '\s+\d{3}$', '')
      and c.region_id = v_region_id
  );

  insert into public.teams (group_id, club_id, name)
  select g.id, c.id, ndt.team_name
  from national_demo_teams ndt
  join public.divisions d on d.league_id = v_league_id
    and d.name = ndt.division_name
  join public.groups g on g.division_id = d.id and g.name = d.name
  join public.clubs c on c.region_id = v_region_id
    and c.name = regexp_replace(ndt.team_name, '\s+\d{3}$', '');

  insert into public.players (name, member_number)
  select
    nc.club_name || ' Player ' || lpad(ps.player_num::text, 2, '0'),
    'DEMO-N' || lpad(nc.club_num::text, 3, '0') || '-P' || lpad(ps.player_num::text, 2, '0')
  from (
    select
      c.name as club_name,
      row_number() over (order by c.name) as club_num,
      count(t.id)::int as team_count
    from public.clubs c
    join public.teams t on t.club_id = c.id
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'national'
    group by c.id, c.name
  ) nc
  cross join lateral generate_series(1, nc.team_count * 4 + 3) as ps(player_num)
  where not exists (
    select 1
    from public.players p
    where p.member_number = 'DEMO-N' || lpad(nc.club_num::text, 3, '0') || '-P' || lpad(ps.player_num::text, 2, '0')
  );

  insert into public.player_club_memberships (player_id, club_id, season_id)
  select p.id, nc.club_id, v_season_id
  from (
    select
      c.id as club_id,
      row_number() over (order by c.name) as club_num,
      count(t.id)::int as team_count
    from public.clubs c
    join public.teams t on t.club_id = c.id
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'national'
    group by c.id, c.name
  ) nc
  cross join lateral generate_series(1, nc.team_count * 4 + 3) as ps(player_num)
  join public.players p on p.member_number =
    'DEMO-N' || lpad(nc.club_num::text, 3, '0') || '-P' || lpad(ps.player_num::text, 2, '0')
  where not exists (
    select 1
    from public.player_club_memberships pcm
    where pcm.player_id = p.id
      and pcm.club_id = nc.club_id
      and pcm.season_id = v_season_id
  );

  insert into public.team_players (team_id, player_id, season_id)
  select
    tr.team_id,
    p.id,
    v_season_id
  from (
    select
      t.id as team_id,
      t.club_id,
      row_number() over (
        partition by t.club_id
        order by d.name, t.name
      ) as team_idx,
      nc.club_num
    from public.teams t
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    join (
      select c.id as club_id, row_number() over (order by c.name) as club_num
      from public.clubs c
      where c.region_id = v_region_id
    ) nc on nc.club_id = t.club_id
    where l.season_id = v_season_id
      and l.scope = 'national'
  ) tr
  cross join lateral generate_series(1, 4) as slot(n)
  join public.players p on p.member_number =
    'DEMO-N' || lpad(tr.club_num::text, 3, '0') || '-P' ||
    lpad(((tr.team_idx - 1) * 4 + slot.n)::text, 2, '0');

  update public.teams t
  set captain_id = p.id
  from (
    select
      t.id as team_id,
      row_number() over (
        partition by t.club_id
        order by d.name, t.name
      ) as team_idx,
      nc.club_num
    from public.teams t
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    join (
      select c.id as club_id, row_number() over (order by c.name) as club_num
      from public.clubs c
      where c.region_id = v_region_id
    ) nc on nc.club_id = t.club_id
    where l.season_id = v_season_id
      and l.scope = 'national'
  ) tr
  join public.players p on p.member_number =
    'DEMO-N' || lpad(tr.club_num::text, 3, '0') || '-P' ||
    lpad(((tr.team_idx - 1) * 4 + 1)::text, 2, '0')
  where t.id = tr.team_id;


end $$;

-- Standard VP tables (24 boards) for every national group
insert into public.vp_tables (group_id, board_count, name)
select g.id, 24, 'Standard 24 boards'
from public.groups g
join public.divisions d on d.id = g.division_id
join public.leagues l on l.id = d.league_id
where l.scope = 'national'
  and not exists (
    select 1
    from public.vp_tables vt
    where vt.group_id = g.id
      and vt.board_count = 24
  );

insert into public.vp_table_rows (vp_table_id, imp_min, imp_max, vp_home, vp_away)
select vt.id, bands.imp_min, bands.imp_max, bands.vp_home, bands.vp_away
from public.vp_tables vt
join public.groups g on g.id = vt.group_id
join public.divisions d on d.id = g.division_id
join public.leagues l on l.id = d.league_id
cross join (
  values
    (-999::numeric, -50::numeric, 0::numeric, 24::numeric),
    (-49::numeric, 0::numeric, 12::numeric, 12::numeric),
    (1::numeric, 999::numeric, 24::numeric, 0::numeric)
) as bands(imp_min, imp_max, vp_home, vp_away)
where l.scope = 'national'
  and vt.board_count = 24
  and not exists (
    select 1 from public.vp_table_rows r where r.vp_table_id = vt.id
  );

select 'national-2024-25-demo reset and loaded (last-season teams, 4 players/team + 3 unassigned/club; generate schedules via Admin or npm run demo:national)' as result;
