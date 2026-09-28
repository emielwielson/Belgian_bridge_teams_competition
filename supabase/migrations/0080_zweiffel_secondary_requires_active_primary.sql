-- Zweiffel second/federation captains must also have an active primary membership
-- (typically at their home club in the other federation).

create or replace function public.enforce_team_captain_club_membership()
returns trigger
language plpgsql
as $$
declare
  v_is_zweiffel boolean;
begin
  if new.captain_id is null then
    return new;
  end if;

  select exists (
    select 1
    from public.groups g
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    join public.competition_kinds ck on ck.id = l.competition_kind_id
    where g.id = new.group_id
      and ck.code = 'zweiffel'
  )
  into v_is_zweiffel;

  if v_is_zweiffel then
    if not exists (
      select 1
      from public.player_club_memberships pcm
      where pcm.player_id = new.captain_id
        and pcm.club_id = new.club_id
        and (
          (pcm.membership_type = 'primary' and pcm.status = 'active')
          or (
            pcm.membership_type in ('second', 'federation')
            and exists (
              select 1
              from public.player_club_memberships pcm_primary
              where pcm_primary.player_id = new.captain_id
                and pcm_primary.membership_type = 'primary'
                and pcm_primary.status = 'active'
            )
          )
        )
    ) then
      raise exception
        'Captain must be an active primary at the team club, or a second/federation member with an active primary club';
    end if;
  else
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
  end if;

  return new;
end;
$$;
