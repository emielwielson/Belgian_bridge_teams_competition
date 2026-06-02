-- Captains were stored on teams.captain_id but not always on team_players.
-- Add each captain to their team's roster for the active season when unambiguous.

insert into public.team_players (team_id, player_id, season_id)
select t.id, t.captain_id, s.id
from public.teams t
cross join public.seasons s
where s.is_active = true
  and t.captain_id is not null
  and not exists (
    select 1
    from public.team_players tp
    where tp.team_id = t.id
      and tp.player_id = t.captain_id
      and tp.season_id = s.id
  )
  and not exists (
    select 1
    from public.team_players tp2
    where tp2.player_id = t.captain_id
      and tp2.season_id = s.id
  );
