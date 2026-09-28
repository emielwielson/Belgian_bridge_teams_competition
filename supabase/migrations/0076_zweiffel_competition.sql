-- Zweiffel: 4th competition unit (Brussels), own region + competition_kind.
-- Clubs remain on Flanders/Wallonia regions; regional club-region match is
-- waived for Zweiffel. Captains may be active primary or second members.

-- Region code
alter table public.regions
  drop constraint if exists regions_code_check;

alter table public.regions
  add constraint regions_code_check
  check (code in ('flanders', 'wallonia', 'zweiffel'));

insert into public.regions (code, name)
values ('zweiffel', 'Zweiffel')
on conflict (code) do nothing;

insert into public.competition_kinds (code, name)
values ('zweiffel', 'Zweiffel')
on conflict (code) do nothing;

-- Season for Zweiffel 2026–27 calendar (inactive until ops activate it)
insert into public.seasons (name, status, is_active)
select '2026-27', 'setup', false
where not exists (
  select 1 from public.seasons where name = '2026-27'
);

-- Allow Flanders/Wallonia clubs on Zweiffel teams
create or replace function public.enforce_regional_team_club_region()
returns trigger
language plpgsql
as $$
declare
  v_league_scope text;
  v_league_region_id uuid;
  v_league_region_code text;
  v_club_region_id uuid;
begin
  select l.scope, l.region_id, r.code
  into v_league_scope, v_league_region_id, v_league_region_code
  from public.teams t
  join public.groups g on g.id = t.group_id
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  left join public.regions r on r.id = l.region_id
  where t.id = new.id;

  select c.region_id into v_club_region_id
  from public.clubs c
  where c.id = new.club_id;

  -- Zweiffel uses clubs from Flanders/Wallonia; skip region match.
  if v_league_region_code = 'zweiffel' then
    return new;
  end if;

  if v_league_scope = 'regional' and v_league_region_id is distinct from v_club_region_id then
    raise exception 'Team club region must match regional league region';
  end if;

  return new;
end;
$$;

-- Captain: primary only, except Zweiffel (primary or second)
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
        and pcm.membership_type in ('primary', 'second')
        and pcm.status = 'active'
    ) then
      raise exception 'Captain must be an active primary or second member of the team club';
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
