-- Enforce team captain is a member of the team's club for the league season

create or replace function public.enforce_team_captain_club_membership()
returns trigger
language plpgsql
as $$
declare
  v_season_id uuid;
begin
  if new.captain_id is null then
    return new;
  end if;

  v_season_id := public.season_id_for_group(new.group_id);
  if v_season_id is null then
    raise exception 'Cannot resolve season for team group';
  end if;

  if not exists (
    select 1
    from public.player_club_memberships pcm
    where pcm.player_id = new.captain_id
      and pcm.club_id = new.club_id
      and pcm.season_id = v_season_id
  ) then
    raise exception 'Captain must be a member of the team club for this season';
  end if;

  return new;
end;
$$;

create trigger teams_captain_club_membership
  before insert or update of captain_id, club_id, group_id on public.teams
  for each row
  execute function public.enforce_team_captain_club_membership();
