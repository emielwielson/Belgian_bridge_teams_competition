-- Team and roster changes are always allowed; remove roster lock gating.

drop trigger if exists team_players_block_active on public.team_players;
drop function if exists public.block_roster_when_active();
drop function if exists public.is_team_roster_locked(uuid);
drop function if exists public.is_group_roster_locked(uuid);

alter table public.leagues
  drop column if exists rosters_locked;
