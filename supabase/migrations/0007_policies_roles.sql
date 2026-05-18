-- Task 2.4: Row Level Security (FR 62–63)

-- Standings view uses caller privileges (underlying table RLS applies)
alter view public.standings_group set (security_invoker = true);

-- Core competition structure
alter table public.regions enable row level security;
alter table public.seasons enable row level security;
alter table public.division_levels enable row level security;
alter table public.leagues enable row level security;
alter table public.divisions enable row level security;
alter table public.groups enable row level security;
alter table public.clubs enable row level security;
alter table public.players enable row level security;
alter table public.player_club_memberships enable row level security;
alter table public.teams enable row level security;
alter table public.team_players enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.vp_tables enable row level security;
alter table public.vp_table_rows enable row level security;
alter table public.penalties enable row level security;
alter table public.warnings enable row level security;
alter table public.rulings enable row level security;
alter table public.match_logs enable row level security;

-- Public read: competition + standings context (FR 63)
create policy regions_public_read on public.regions
  for select to anon, authenticated using (true);

create policy seasons_public_read on public.seasons
  for select to anon, authenticated using (true);

create policy division_levels_public_read on public.division_levels
  for select to anon, authenticated using (true);

create policy leagues_public_read on public.leagues
  for select to anon, authenticated using (true);

create policy divisions_public_read on public.divisions
  for select to anon, authenticated using (true);

create policy groups_public_read on public.groups
  for select to anon, authenticated using (true);

create policy clubs_public_read on public.clubs
  for select to anon, authenticated using (true);

create policy players_public_read on public.players
  for select to anon, authenticated using (true);

create policy player_club_memberships_public_read on public.player_club_memberships
  for select to anon, authenticated using (true);

create policy teams_public_read on public.teams
  for select to anon, authenticated using (true);

create policy team_players_public_read on public.team_players
  for select to anon, authenticated using (true);

create policy matches_public_read on public.matches
  for select to anon, authenticated using (true);

create policy match_players_public_read on public.match_players
  for select to anon, authenticated using (true);

create policy vp_tables_public_read on public.vp_tables
  for select to anon, authenticated using (true);

create policy vp_table_rows_public_read on public.vp_table_rows
  for select to anon, authenticated using (true);

create policy penalties_public_read on public.penalties
  for select to anon, authenticated using (true);

create policy warnings_public_read on public.warnings
  for select to anon, authenticated using (true);

create policy rulings_public_read on public.rulings
  for select to anon, authenticated using (true);

-- Competition managers: write competition data (broad MVP; refined in Task 3)
create policy regions_manager_write on public.regions
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy seasons_manager_write on public.seasons
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy division_levels_manager_write on public.division_levels
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy leagues_manager_write on public.leagues
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy divisions_manager_write on public.divisions
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy groups_manager_write on public.groups
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy clubs_manager_write on public.clubs
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy players_manager_write on public.players
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy player_club_memberships_manager_write on public.player_club_memberships
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy teams_manager_write on public.teams
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy team_players_manager_write on public.team_players
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy matches_manager_write on public.matches
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy match_players_manager_write on public.match_players
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy vp_tables_manager_write on public.vp_tables
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy vp_table_rows_manager_write on public.vp_table_rows
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy penalties_manager_write on public.penalties
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy warnings_manager_write on public.warnings
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy rulings_manager_write on public.rulings
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy match_logs_manager_read on public.match_logs
  for select to authenticated
  using (public.current_user_is_competition_manager());

create policy match_logs_manager_insert on public.match_logs
  for insert to authenticated
  with check (public.current_user_is_competition_manager());

-- user_roles (enabled in 0005)
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.current_user_is_system_admin());

create policy user_roles_admin_write on public.user_roles
  for all to authenticated
  using (public.current_user_is_system_admin())
  with check (public.current_user_is_system_admin());

grant select on public.standings_group to anon, authenticated;
