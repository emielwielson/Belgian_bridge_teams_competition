-- Task 1.5: Competition lifecycle locks (PRD FR 13, 17–18, 24)

create or replace function public.is_season_active(p_season_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.seasons s
    where s.id = p_season_id
      and s.status = 'active'
  );
$$;

create or replace function public.is_group_active(p_group_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.status = 'active'
  );
$$;

create or replace function public.season_id_for_group(p_group_id uuid)
returns uuid
language sql
stable
as $$
  select l.season_id
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where g.id = p_group_id;
$$;

-- Block membership changes when season is active (FR 13)
create or replace function public.block_membership_when_active()
returns trigger
language plpgsql
as $$
declare
  v_season_id uuid;
begin
  v_season_id := coalesce(new.season_id, old.season_id);
  if public.is_season_active(v_season_id) then
    raise exception 'Player-club membership cannot change while season is active';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger player_club_memberships_block_active
  before insert or update or delete on public.player_club_memberships
  for each row
  execute function public.block_membership_when_active();

-- Block roster changes when season is active (FR 17–18)
create or replace function public.block_roster_when_active()
returns trigger
language plpgsql
as $$
declare
  v_season_id uuid;
begin
  v_season_id := coalesce(new.season_id, old.season_id);
  if public.is_season_active(v_season_id) then
    raise exception 'Team roster cannot change while season is active';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger team_players_block_active
  before insert or update or delete on public.team_players
  for each row
  execute function public.block_roster_when_active();

-- Block match deletion when group or season is active (FR 24)
create or replace function public.block_match_delete_when_active()
returns trigger
language plpgsql
as $$
declare
  v_season_id uuid;
begin
  if public.is_group_active(old.group_id) then
    raise exception 'Matches cannot be deleted while group competition is active';
  end if;
  v_season_id := public.season_id_for_group(old.group_id);
  if public.is_season_active(v_season_id) then
    raise exception 'Matches cannot be deleted while season is active';
  end if;
  return old;
end;
$$;

create trigger matches_block_delete_active
  before delete on public.matches
  for each row
  execute function public.block_match_delete_when_active();
