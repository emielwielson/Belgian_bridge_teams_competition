-- Task 1.3: Constraints and indexes (PRD FR 12, 16, 19, 21–25)

-- One active season (FR 6–7)
create unique index seasons_one_active_idx
  on public.seasons (is_active)
  where is_active = true;

-- One club per player per season (FR 12)
alter table public.player_club_memberships
  add constraint player_club_memberships_player_season_unique
  unique (player_id, season_id);

-- One team per player per season (FR 16)
alter table public.team_players
  add constraint team_players_player_season_unique
  unique (player_id, season_id);

-- Match pairing rules (FR 21–22, 25)
alter table public.matches
  add constraint matches_home_away_different check (home_team_id <> away_team_id);

create unique index matches_group_round_home_unique
  on public.matches (group_id, round, home_team_id);

create unique index matches_group_round_away_unique
  on public.matches (group_id, round, away_team_id);

create unique index matches_group_round_fixture_unique
  on public.matches (group_id, round, home_team_id, away_team_id);

-- Regional league: team club region must match league region (FR 19)
create or replace function public.enforce_regional_team_club_region()
returns trigger
language plpgsql
as $$
declare
  v_league_scope text;
  v_league_region_id uuid;
  v_club_region_id uuid;
begin
  select l.scope, l.region_id
  into v_league_scope, v_league_region_id
  from public.teams t
  join public.groups g on g.id = t.group_id
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where t.id = new.id;

  select c.region_id into v_club_region_id
  from public.clubs c
  where c.id = new.club_id;

  if v_league_scope = 'regional' and v_league_region_id is distinct from v_club_region_id then
    raise exception 'Team club region must match regional league region';
  end if;

  return new;
end;
$$;

create trigger teams_regional_club_region
  before insert or update on public.teams
  for each row
  execute function public.enforce_regional_team_club_region();

-- Teams must belong to the same group as their match assignment
create or replace function public.enforce_match_teams_in_group()
returns trigger
language plpgsql
as $$
declare
  v_home_group uuid;
  v_away_group uuid;
begin
  select group_id into v_home_group from public.teams where id = new.home_team_id;
  select group_id into v_away_group from public.teams where id = new.away_team_id;

  if v_home_group is distinct from new.group_id or v_away_group is distinct from new.group_id then
    raise exception 'Home and away teams must belong to the match group';
  end if;

  return new;
end;
$$;

create trigger matches_teams_in_group
  before insert or update on public.matches
  for each row
  execute function public.enforce_match_teams_in_group();

-- Indexes for lookups
create index leagues_season_id_idx on public.leagues (season_id);
create index leagues_region_id_idx on public.leagues (region_id);
create index divisions_league_id_idx on public.divisions (league_id);
create index groups_division_id_idx on public.groups (division_id);
create index clubs_region_id_idx on public.clubs (region_id);
create index player_club_memberships_season_id_idx on public.player_club_memberships (season_id);
create index player_club_memberships_club_id_idx on public.player_club_memberships (club_id);
create index teams_group_id_idx on public.teams (group_id);
create index teams_club_id_idx on public.teams (club_id);
create index team_players_team_id_idx on public.team_players (team_id);
create index team_players_season_id_idx on public.team_players (season_id);
create index matches_group_id_idx on public.matches (group_id);
create index matches_group_round_idx on public.matches (group_id, round);
create index matches_datetime_idx on public.matches (datetime);
create index match_players_match_id_idx on public.match_players (match_id);
