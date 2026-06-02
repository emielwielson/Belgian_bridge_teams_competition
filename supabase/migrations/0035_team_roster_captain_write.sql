-- Allow team captains to add/remove roster players during season setup.

create policy team_players_captain_write on public.team_players
  for all to authenticated
  using (public.current_user_is_captain_of_team(team_id))
  with check (public.current_user_is_captain_of_team(team_id));
