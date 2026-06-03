-- Captains were stored on teams.captain_id but not always on team_players.
-- Allow inserting the designated captain during an active season (roster lock still applies to everyone else).
-- Then backfill captains missing from roster for the current season (is_active).

create or replace function public.block_roster_when_active()
returns trigger
language plpgsql
as $$
declare
  v_season_id uuid;
begin
  v_season_id := coalesce(new.season_id, old.season_id);
  if public.is_season_active(v_season_id) then
    if TG_OP = 'INSERT'
      and new.team_id is not null
      and new.player_id is not null
      and exists (
        select 1
        from public.teams t
        where t.id = new.team_id
          and t.captain_id = new.player_id
      ) then
      return new;
    end if;
    raise exception 'Team roster cannot change while season is active';
  end if;
  return coalesce(new, old);
end;
$$;

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
