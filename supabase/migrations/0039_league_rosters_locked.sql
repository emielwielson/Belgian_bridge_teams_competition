-- Roster changes are gated by leagues.rosters_locked (manager action), not season status.

alter table public.leagues
  add column if not exists rosters_locked boolean not null default false;

create or replace function public.is_team_roster_locked(p_team_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(l.rosters_locked, false)
  from public.teams t
  join public.groups g on g.id = t.group_id
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where t.id = p_team_id;
$$;

create or replace function public.is_group_roster_locked(p_group_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(l.rosters_locked, false)
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where g.id = p_group_id;
$$;

create or replace function public.block_roster_when_active()
returns trigger
language plpgsql
as $$
declare
  v_team_id uuid;
begin
  v_team_id := coalesce(new.team_id, old.team_id);
  if public.is_team_roster_locked(v_team_id) then
    raise exception 'Team roster cannot change while rosters are locked';
  end if;
  return coalesce(new, old);
end;
$$;

grant execute on function public.is_team_roster_locked(uuid) to authenticated;
grant execute on function public.is_group_roster_locked(uuid) to authenticated;
