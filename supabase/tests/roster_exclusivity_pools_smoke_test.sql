-- Smoke test: roster exclusivity pools (0078)
-- linked (national/flanders/wallonia) share one slot; Zweiffel is separate.
-- Reuses existing leagues (one national / one regional per region per season)
-- and creates temporary groups/teams that are rolled back.

do $$
begin
  if to_regprocedure('public.team_roster_exclusivity_pool(text)') is null then
    raise exception 'Missing function: team_roster_exclusivity_pool';
  end if;

  if public.team_roster_exclusivity_pool('national') <> 'linked'
    or public.team_roster_exclusivity_pool('flanders') <> 'linked'
    or public.team_roster_exclusivity_pool('wallonia') <> 'linked'
    or public.team_roster_exclusivity_pool('zweiffel') <> 'zweiffel'
  then
    raise exception 'team_roster_exclusivity_pool mapping incorrect';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'team_players_exclusivity_pool'
      and tgrelid = 'public.team_players'::regclass
  ) then
    raise exception 'Missing trigger: team_players_exclusivity_pool';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'team_players_player_season_unique'
      and conrelid = 'public.team_players'::regclass
  ) then
    raise exception 'team_players_player_season_unique should be dropped';
  end if;
end $$;

begin;

do $$
declare
  v_season_id uuid;
  v_flanders_region uuid;
  v_zweiffel_region uuid;
  v_club_id uuid;
  v_player_id uuid;
  v_national_league uuid;
  v_flanders_league uuid;
  v_zweiffel_league uuid;
  v_national_div uuid;
  v_flanders_div uuid;
  v_zweiffel_div uuid;
  v_national_group uuid;
  v_flanders_group uuid;
  v_zweiffel_group uuid;
  v_national_team uuid;
  v_flanders_team uuid;
  v_zweiffel_team1 uuid;
  v_zweiffel_team2 uuid;
begin
  select id into v_season_id from public.seasons where is_active = true limit 1;
  if v_season_id is null then
    raise exception 'No active season — run seed first';
  end if;

  select id into v_flanders_region from public.regions where code = 'flanders';
  select id into v_zweiffel_region from public.regions where code = 'zweiffel';

  if v_flanders_region is null or v_zweiffel_region is null then
    raise exception 'Missing regions for roster exclusivity smoke test';
  end if;

  select l.id into v_national_league
  from public.leagues l
  join public.competition_kinds ck on ck.id = l.competition_kind_id
  where l.season_id = v_season_id and ck.code = 'national'
  limit 1;

  select l.id into v_flanders_league
  from public.leagues l
  join public.competition_kinds ck on ck.id = l.competition_kind_id
  where l.season_id = v_season_id and ck.code = 'flanders'
  limit 1;

  select l.id into v_zweiffel_league
  from public.leagues l
  join public.competition_kinds ck on ck.id = l.competition_kind_id
  where l.season_id = v_season_id and ck.code = 'zweiffel'
  limit 1;

  if v_national_league is null then
    raise exception 'Missing national league for active season';
  end if;
  if v_flanders_league is null then
    raise exception 'Missing Flanders league for active season';
  end if;
  if v_zweiffel_league is null then
    raise exception 'Missing Zweiffel league for active season';
  end if;

  select id into v_national_div
  from public.divisions
  where league_id = v_national_league
  limit 1;

  select id into v_flanders_div
  from public.divisions
  where league_id = v_flanders_league
  limit 1;

  select id into v_zweiffel_div
  from public.divisions
  where league_id = v_zweiffel_league
  limit 1;

  if v_national_div is null or v_flanders_div is null or v_zweiffel_div is null then
    raise exception 'Missing divisions — ensure competition structure exists';
  end if;

  select id into v_club_id from public.clubs where region_id = v_flanders_region limit 1;
  if v_club_id is null then
    insert into public.clubs (name, region_id)
    values ('Roster Pool Smoke Club', v_flanders_region)
    returning id into v_club_id;
  end if;

  insert into public.players (name, federation)
  values ('Roster Pool Smoke Player', 'vbl')
  returning id into v_player_id;

  -- Temporary groups/teams under existing divisions (rolled back)
  insert into public.groups (division_id, name)
  values (v_national_div, 'Roster Pool Nat G')
  returning id into v_national_group;

  insert into public.groups (division_id, name)
  values (v_flanders_div, 'Roster Pool Fl G')
  returning id into v_flanders_group;

  insert into public.groups (division_id, name)
  values (v_zweiffel_div, 'Roster Pool Zw G')
  returning id into v_zweiffel_group;

  insert into public.teams (group_id, club_id, name)
  values (v_national_group, v_club_id, 'Roster Pool Nat Team')
  returning id into v_national_team;

  insert into public.teams (group_id, club_id, name)
  values (v_flanders_group, v_club_id, 'Roster Pool Fl Team')
  returning id into v_flanders_team;

  insert into public.teams (group_id, club_id, name)
  values (v_zweiffel_group, v_club_id, 'Roster Pool Zw Team 1')
  returning id into v_zweiffel_team1;

  insert into public.teams (group_id, club_id, name)
  values (v_zweiffel_group, v_club_id, 'Roster Pool Zw Team 2')
  returning id into v_zweiffel_team2;

  -- Linked + Zweiffel allowed
  insert into public.team_players (team_id, player_id, season_id)
  values (v_national_team, v_player_id, v_season_id);

  insert into public.team_players (team_id, player_id, season_id)
  values (v_zweiffel_team1, v_player_id, v_season_id);

  -- Linked ↔ linked conflict
  begin
    insert into public.team_players (team_id, player_id, season_id)
    values (v_flanders_team, v_player_id, v_season_id);
    raise exception 'Expected linked-pool conflict for Flanders after National';
  exception
    when others then
      if sqlerrm not like '%same competition%' then
        raise;
      end if;
  end;

  -- Zweiffel ↔ Zweiffel conflict
  begin
    insert into public.team_players (team_id, player_id, season_id)
    values (v_zweiffel_team2, v_player_id, v_season_id);
    raise exception 'Expected Zweiffel-pool conflict for second Zweiffel team';
  exception
    when others then
      if sqlerrm not like '%same competition%' then
        raise;
      end if;
  end;

  raise notice 'roster_exclusivity_pools_smoke_test passed';
end $$;

rollback;
