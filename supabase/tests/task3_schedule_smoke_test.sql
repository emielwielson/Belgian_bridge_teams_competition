-- Task 3.10: Schedule generation and lock smoke tests (run after 0008)

-- 1) Schema and helper function
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'competition_match_dates'
  ) then
    raise exception 'Missing table: competition_match_dates';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'club_manager_assignments'
  ) then
    raise exception 'Missing table: club_manager_assignments';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'validate_group_schedule_generation'
  ) then
    raise exception 'Missing function: validate_group_schedule_generation';
  end if;
end $$;

-- 2) End-to-end checks in a rolled-back transaction (no leftover data)
begin;

do $$
declare
  v_season_id uuid;
  v_league_id uuid;
  v_division_id uuid;
  v_group_id uuid;
  v_club_id uuid;
  v_team_id uuid;
  v_other_team_id uuid;
  v_player_id uuid;
  v_round1_id uuid;
begin
  select id into v_season_id from public.seasons where is_active = true limit 1;
  if v_season_id is null then
    raise exception 'No active season — run seed first';
  end if;

  -- Ensure season is in setup for generation test
  update public.seasons set status = 'setup' where id = v_season_id;

  insert into public.leagues (season_id, scope, region_id, name)
  values (v_season_id, 'national', null, 'Task3 Smoke League')
  returning id into v_league_id;

  insert into public.divisions (league_id, division_level_id, name)
  select v_league_id, dl.id, 'Smoke Division'
  from public.division_levels dl
  where dl.code = 'honor'
  returning id into v_division_id;

  insert into public.groups (division_id, name, max_matches_per_day_per_team)
  values (v_division_id, 'Smoke Group', 1)
  returning id into v_group_id;

  select id into v_club_id from public.clubs limit 1;
  if v_club_id is null then
    insert into public.clubs (name, region_id)
    select 'Smoke Club', id from public.regions where code = 'flanders'
    returning id into v_club_id;
  end if;

  -- 8 teams for RBBF
  for i in 1..8 loop
    insert into public.teams (group_id, club_id, name)
    values (v_group_id, v_club_id, 'Smoke Team ' || i);
  end loop;

  -- 14 match dates
  for i in 1..14 loop
    insert into public.competition_match_dates (season_id, scope, region_id, round, datetime)
    values (
      v_season_id,
      'national',
      null,
      i,
      timestamptz '2025-09-01 12:00:00+00' + (i || ' days')::interval
    );
  end loop;

  perform public.validate_group_schedule_generation(v_group_id);

  -- Wrong team count must fail
  begin
    delete from public.teams
    where group_id = v_group_id
      and id = (select id from public.teams where group_id = v_group_id limit 1);

    perform public.validate_group_schedule_generation(v_group_id);
    raise exception 'validate_group_schedule_generation should fail with 7 teams';
  exception
    when others then
      if sqlerrm not like '%exactly 8 teams%' then
        raise;
      end if;
  end;

  -- Restore 8th team
  insert into public.teams (group_id, club_id, name)
  values (v_group_id, v_club_id, 'Smoke Team 8');

  -- max_matches_per_day_per_team = 1: second match same day must fail
  select id into v_team_id from public.teams where group_id = v_group_id limit 1;
  select id into v_other_team_id
  from public.teams
  where group_id = v_group_id and id <> v_team_id
  limit 1;

  insert into public.matches (
    group_id, round, datetime, home_team_id, away_team_id, board_count
  ) values (
    v_group_id, 1, timestamptz '2025-10-01 14:00:00+00',
    v_team_id, v_other_team_id, 24
  ) returning id into v_round1_id;

  begin
    insert into public.matches (
      group_id, round, datetime, home_team_id, away_team_id, board_count
    ) values (
      v_group_id, 2, timestamptz '2025-10-01 18:00:00+00',
      v_team_id,
      (select id from public.teams where group_id = v_group_id and id not in (v_team_id, v_other_team_id) limit 1),
      24
    );
    raise exception 'max_matches_per_day trigger should have blocked second match';
  exception
    when others then
      if sqlerrm not like '%max_matches_per_day%' then
        raise;
      end if;
  end;

  -- Active season blocks roster changes (FR 17–18)
  insert into public.players (name) values ('Smoke Player') returning id into v_player_id;
  insert into public.player_club_memberships (player_id, club_id, season_id)
  values (v_player_id, v_club_id, v_season_id);

  update public.seasons set status = 'active' where id = v_season_id;

  begin
    insert into public.team_players (team_id, player_id, season_id)
    values (v_team_id, v_player_id, v_season_id);
    raise exception 'team_players insert should fail when season is active';
  exception
    when others then
      if sqlerrm not like '%roster cannot change%' then
        raise;
      end if;
  end;
end $$;

rollback;

-- 3) Regional odd-team validation (7 teams, 14 dates)
begin;

do $$
declare
  v_season_id uuid;
  v_region_id uuid;
  v_league_id uuid;
  v_division_id uuid;
  v_group_id uuid;
  v_club_id uuid;
begin
  select id into v_season_id from public.seasons where is_active = true limit 1;
  select id into v_region_id from public.regions where code = 'flanders' limit 1;

  insert into public.leagues (season_id, scope, region_id, name)
  values (v_season_id, 'regional', v_region_id, 'Task3 Regional Smoke')
  returning id into v_league_id;

  insert into public.divisions (league_id, division_level_id, name)
  select v_league_id, dl.id, 'Regional Smoke Div'
  from public.division_levels dl where dl.code = 'second'
  returning id into v_division_id;

  insert into public.groups (division_id, name, round_robin_count, round_count)
  values (v_division_id, 'Regional Smoke G', 2, 14)
  returning id into v_group_id;

  select id into v_club_id from public.clubs where region_id = v_region_id limit 1;

  for i in 1..7 loop
    insert into public.teams (group_id, club_id, name)
    values (v_group_id, v_club_id, 'Regional Smoke ' || i);
  end loop;

  for i in 1..14 loop
    insert into public.competition_match_dates (season_id, scope, region_id, division_id, round, datetime)
    values (
      v_season_id, 'regional', v_region_id, null, i,
      timestamptz '2024-09-01 12:00:00+00' + (i || ' days')::interval
    );
  end loop;

  perform public.validate_group_schedule_generation(v_group_id);

  if public.compute_group_round_count(7, 2) <> 14 then
    raise exception 'compute_group_round_count(7,2) should be 14';
  end if;
end $$;

rollback;

select 'task3_schedule_smoke_test passed' as result;
