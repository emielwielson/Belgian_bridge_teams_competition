-- Non-playing captains (teams.captain_id, not on team_players) get the same
-- match ops and convention-card rights as rostered captains.

create or replace function public.current_user_is_captain_of_match(p_match_id uuid)
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
      and (
        public.current_user_is_captain_of_team(m.home_team_id)
        or public.current_user_is_captain_of_team(m.away_team_id)
      )
  );
$$;

create or replace function public.current_user_can_submit_score(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_manages_match(p_match_id)
    or public.current_user_on_match_team(p_match_id)
    or public.current_user_is_captain_of_match(p_match_id);
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
        public.current_user_manages_match(p_match_id)
        or public.current_user_on_match_team(p_match_id)
        or public.current_user_is_captain_of_match(p_match_id)
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
  select public.current_user_manages_team(p_team_id)
    or public.current_user_on_team(p_team_id)
    or public.current_user_is_captain_of_team(p_team_id);
$$;

grant execute on function public.current_user_is_captain_of_match(uuid) to authenticated;
grant execute on function public.current_user_can_submit_score(uuid) to authenticated;
grant execute on function public.current_user_can_edit_lineup(uuid) to authenticated;
grant execute on function public.current_user_can_manage_team_convention_cards(uuid) to authenticated;
