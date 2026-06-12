-- Club setup is competition-manager only; captains manage team rosters via teams.captain_id.

delete from public.user_roles where role = 'club_manager';

alter table public.user_roles drop constraint user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (
  role in (
    'player',
    'arbiter',
    'competition_manager',
    'system_admin'
  )
);

-- Score and lineup: competition managers and match players only
create or replace function public.current_user_can_submit_score(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_competition_manager()
    or public.current_user_on_match_team(p_match_id);
$$;

create or replace function public.current_user_can_edit_lineup(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and m.played_at is null
      and (
        public.current_user_is_competition_manager()
        or public.current_user_on_match_team(p_match_id)
      )
  );
$$;

create or replace function public.current_user_can_manage_team_convention_cards(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_competition_manager()
    or public.current_user_on_team(p_team_id);
$$;

-- RLS: competition-manager-only writes (replace club-manager scoped policies)
drop policy if exists clubs_club_manager_write on public.clubs;
create policy clubs_competition_manager_write on public.clubs
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

drop policy if exists player_club_memberships_club_manager_write on public.player_club_memberships;
create policy player_club_memberships_competition_manager_write on public.player_club_memberships
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

drop policy if exists teams_club_manager_write on public.teams;
create policy teams_competition_manager_write on public.teams
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

drop policy if exists team_players_club_manager_write on public.team_players;
create policy team_players_competition_manager_write on public.team_players
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

drop policy if exists players_club_manager_update on public.players;
create policy players_competition_manager_update on public.players
  for update to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

-- Drop club manager assignment infrastructure
drop policy if exists club_manager_assignments_select on public.club_manager_assignments;
drop policy if exists club_manager_assignments_manager_write on public.club_manager_assignments;
drop table public.club_manager_assignments;

drop function if exists public.current_user_manages_match_club(uuid);
drop function if exists public.current_user_manages_club(uuid);
drop function if exists public.current_user_is_club_manager();
