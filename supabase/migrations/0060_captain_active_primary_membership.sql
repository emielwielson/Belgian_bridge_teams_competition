-- Captain eligibility: active primary membership at the team club
-- (do not use season_id; transfers leave season_id null on the new primary)

create or replace function public.enforce_team_captain_club_membership()
returns trigger
language plpgsql
as $$
begin
  if new.captain_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.player_club_memberships pcm
    where pcm.player_id = new.captain_id
      and pcm.club_id = new.club_id
      and pcm.membership_type = 'primary'
      and pcm.status = 'active'
  ) then
    raise exception 'Captain must be an active primary member of the team club';
  end if;

  return new;
end;
$$;
