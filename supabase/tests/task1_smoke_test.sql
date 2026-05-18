-- Task 1.7: Schema smoke tests (run in SQL Editor after migrations + seed)

do $$
declare
  v_count int;
  v_tables text[] := array[
    'regions', 'seasons', 'division_levels', 'leagues', 'divisions',
    'groups', 'clubs', 'players', 'player_club_memberships',
    'teams', 'team_players', 'matches', 'match_players',
    'vp_tables', 'vp_table_rows', 'penalties', 'warnings', 'rulings',
    'match_logs'
  ];
  v_table text;
begin
  foreach v_table in array v_tables loop
    select count(*) into v_count
    from information_schema.tables
    where table_schema = 'public' and table_name = v_table;

    if v_count <> 1 then
      raise exception 'Missing table: %', v_table;
    end if;
  end loop;

  select count(*) into v_count
  from information_schema.views
  where table_schema = 'public' and table_name = 'standings_group';

  if v_count <> 1 then
    raise exception 'Missing view: standings_group';
  end if;
end $$;

-- Seed assertions
do $$
begin
  if (select count(*) from public.regions) < 2 then
    raise exception 'Expected at least 2 regions';
  end if;
  if (select count(*) from public.seasons where is_active = true) <> 1 then
    raise exception 'Expected exactly one active season';
  end if;
  if (select count(*) from public.division_levels) < 4 then
    raise exception 'Expected 4 division levels';
  end if;
end $$;

-- Negative: duplicate active season
do $$
begin
  begin
    insert into public.seasons (name, status, is_active)
    values ('duplicate-active', 'setup', true);
    raise exception 'Should not allow second active season';
  exception
    when unique_violation then
      null;
  end;
end $$;

-- Negative: home = away
do $$
declare
  v_group_id uuid;
  v_club_id uuid;
  v_team_home uuid;
  v_team_away uuid;
begin
  select g.id into v_group_id
  from public.groups g
  where g.name = 'VP Template Group'
  limit 1;

  insert into public.clubs (name, region_id)
  select 'Smoke Test Club', r.id
  from public.regions r
  where r.code = 'flanders'
  returning id into v_club_id;

  insert into public.teams (group_id, club_id, name)
  values (v_group_id, v_club_id, 'Smoke Home')
  returning id into v_team_home;

  insert into public.teams (group_id, club_id, name)
  values (v_group_id, v_club_id, 'Smoke Away')
  returning id into v_team_away;

  begin
    insert into public.matches (
      group_id, round, datetime, home_team_id, away_team_id, board_count
    ) values (
      v_group_id, 99, now(), v_team_home, v_team_home, 24
    );
    raise exception 'Should not allow home_team_id = away_team_id';
  exception
    when check_violation then
      null;
  end;

  delete from public.teams where id in (v_team_home, v_team_away);
  delete from public.clubs where id = v_club_id;
end $$;

select 'task1_smoke_test passed' as result;
