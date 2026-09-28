-- Roster exclusivity: national/flanders/wallonia share one pool; Zweiffel is separate.
-- A player may be on one linked-pool team and one Zweiffel team in the same season.

alter table public.team_players
  drop constraint if exists team_players_player_season_unique;

create or replace function public.team_roster_exclusivity_pool(p_kind_code text)
returns text
language plpgsql
immutable
as $$
begin
  if p_kind_code = 'zweiffel' then
    return 'zweiffel';
  end if;
  if p_kind_code in ('national', 'flanders', 'wallonia') then
    return 'linked';
  end if;
  raise exception 'Unknown competition kind for roster exclusivity: %', p_kind_code;
end;
$$;

create or replace function public.enforce_team_players_exclusivity_pool()
returns trigger
language plpgsql
as $$
declare
  v_kind_code text;
  v_pool text;
  v_conflict_team_id uuid;
begin
  select ck.code
  into v_kind_code
  from public.teams t
  join public.groups g on g.id = t.group_id
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  join public.competition_kinds ck on ck.id = l.competition_kind_id
  where t.id = new.team_id;

  if v_kind_code is null then
    raise exception 'Cannot resolve competition kind for team %', new.team_id;
  end if;

  v_pool := public.team_roster_exclusivity_pool(v_kind_code);

  select tp.team_id
  into v_conflict_team_id
  from public.team_players tp
  join public.teams t on t.id = tp.team_id
  join public.groups g on g.id = t.group_id
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  join public.competition_kinds ck on ck.id = l.competition_kind_id
  where tp.player_id = new.player_id
    and tp.season_id = new.season_id
    and tp.team_id is distinct from new.team_id
    and public.team_roster_exclusivity_pool(ck.code) = v_pool
  limit 1;

  if v_conflict_team_id is not null then
    raise exception
      'Player is already on another team this season in the same competition';
  end if;

  return new;
end;
$$;

drop trigger if exists team_players_exclusivity_pool on public.team_players;

create trigger team_players_exclusivity_pool
  before insert or update of team_id, player_id, season_id
  on public.team_players
  for each row
  execute function public.enforce_team_players_exclusivity_pool();

grant execute on function public.team_roster_exclusivity_pool(text) to anon, authenticated;
