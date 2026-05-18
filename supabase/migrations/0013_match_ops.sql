-- Task 4.1–4.4: Match operations (lineups, VP lookup, scoring, admin edits)

-- User ↔ player link (users have email; players may not)
alter table public.players
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists players_auth_user_id_unique
  on public.players (auth_user_id)
  where auth_user_id is not null;

-- Authorization helpers
create or replace function public.current_user_player_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.players p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_on_match_team(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    join public.groups g on g.id = m.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues lg on lg.id = d.league_id
    join public.team_players tp on tp.player_id = public.current_user_player_id()
      and tp.season_id = lg.season_id
      and tp.team_id in (m.home_team_id, m.away_team_id)
    where m.id = p_match_id
      and public.current_user_player_id() is not null
  );
$$;

create or replace function public.current_user_manages_match_club(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    join public.teams ht on ht.id = m.home_team_id
    join public.teams at on at.id = m.away_team_id
    where m.id = p_match_id
      and (
        public.current_user_manages_club(ht.club_id)
        or public.current_user_manages_club(at.club_id)
      )
  );
$$;

create or replace function public.current_user_can_admin_edit_score(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_competition_manager();
$$;

create or replace function public.current_user_can_submit_score(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_competition_manager()
    or public.current_user_manages_match_club(p_match_id)
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
        or public.current_user_manages_match_club(p_match_id)
        or public.current_user_on_match_team(p_match_id)
      )
  );
$$;

create or replace function public.current_user_can_view_match_ops(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_submit_score(p_match_id);
$$;

grant execute on function public.current_user_player_id() to authenticated;
grant execute on function public.current_user_on_match_team(uuid) to authenticated;
grant execute on function public.current_user_manages_match_club(uuid) to authenticated;
grant execute on function public.current_user_can_admin_edit_score(uuid) to authenticated;
grant execute on function public.current_user_can_submit_score(uuid) to authenticated;
grant execute on function public.current_user_can_edit_lineup(uuid) to authenticated;
grant execute on function public.current_user_can_view_match_ops(uuid) to authenticated;

-- VP lookup (FR 38–39): net IMP = imps_home - imps_away
create or replace function public.lookup_vp_for_match(
  p_match_id uuid,
  p_imps_home numeric,
  p_imps_away numeric
)
returns table (vp_home numeric, vp_away numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_board_count int;
  v_net numeric;
  v_vp_home numeric;
  v_vp_away numeric;
begin
  select m.group_id, m.board_count
  into v_group_id, v_board_count
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  v_net := p_imps_home - p_imps_away;

  select r.vp_home, r.vp_away
  into v_vp_home, v_vp_away
  from public.vp_tables vt
  join public.vp_table_rows r on r.vp_table_id = vt.id
  where vt.group_id = v_group_id
    and vt.board_count = v_board_count
    and v_net >= r.imp_min
    and v_net <= r.imp_max
  limit 1;

  if v_vp_home is null then
    raise exception 'No VP band for net IMP % (group %, boards %)', v_net, v_group_id, v_board_count;
  end if;

  vp_home := v_vp_home;
  vp_away := v_vp_away;
  return next;
end;
$$;

grant execute on function public.lookup_vp_for_match(uuid, numeric, numeric) to authenticated;

-- match_players: team must be home or away
create or replace function public.enforce_match_player_team_in_match()
returns trigger
language plpgsql
as $$
declare
  v_home uuid;
  v_away uuid;
begin
  select home_team_id, away_team_id
  into v_home, v_away
  from public.matches
  where id = coalesce(new.match_id, old.match_id);

  if new.team_id is distinct from v_home and new.team_id is distinct from v_away then
    raise exception 'team_id must be home or away for this match';
  end if;

  return new;
end;
$$;

drop trigger if exists match_players_team_in_match on public.match_players;
create trigger match_players_team_in_match
  before insert or update of team_id, match_id on public.match_players
  for each row
  execute function public.enforce_match_player_team_in_match();

-- Score edit lock after played (FR 35)
create or replace function public.enforce_match_score_edit_policy()
returns trigger
language plpgsql
as $$
begin
  if old.played_at is not null
    and (
      new.imps_home is distinct from old.imps_home
      or new.imps_away is distinct from old.imps_away
      or new.vp_home is distinct from old.vp_home
      or new.vp_away is distinct from old.vp_away
    )
    and not public.current_user_is_competition_manager()
  then
    raise exception 'Score edits after match is played require competition manager or system admin';
  end if;

  if (
    new.imps_home is distinct from old.imps_home
    or new.imps_away is distinct from old.imps_away
    or new.vp_home is distinct from old.vp_home
    or new.vp_away is distinct from old.vp_away
  ) then
    new.last_modified_by := auth.uid();
    new.last_modified_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists matches_score_edit_policy on public.matches;
create trigger matches_score_edit_policy
  before update of imps_home, imps_away, vp_home, vp_away on public.matches
  for each row
  execute function public.enforce_match_score_edit_policy();

-- Club managers may link auth user to players in their club
create policy players_club_manager_update on public.players
  for update to authenticated
  using (
    public.current_user_is_competition_manager()
    or exists (
      select 1
      from public.player_club_memberships pcm
      join public.club_manager_assignments cma on cma.club_id = pcm.club_id
      where pcm.player_id = players.id
        and cma.user_id = auth.uid()
    )
  )
  with check (
    public.current_user_is_competition_manager()
    or exists (
      select 1
      from public.player_club_memberships pcm
      join public.club_manager_assignments cma on cma.club_id = pcm.club_id
      where pcm.player_id = players.id
        and cma.user_id = auth.uid()
    )
  );

-- Lineup writes (FR 27–31)
create policy match_players_lineup_write on public.match_players
  for all to authenticated
  using (public.current_user_can_edit_lineup(match_id))
  with check (public.current_user_can_edit_lineup(match_id));

-- Score submission / admin edit on matches
create policy matches_score_submit on public.matches
  for update to authenticated
  using (
    played_at is null
    and public.current_user_can_submit_score(id)
  )
  with check (public.current_user_can_submit_score(id));

create policy matches_score_admin_edit on public.matches
  for update to authenticated
  using (
    played_at is not null
    and public.current_user_can_admin_edit_score(id)
  )
  with check (
    public.current_user_can_admin_edit_score(id)
  );

-- Match logs for score events
create policy match_logs_score_insert on public.match_logs
  for insert to authenticated
  with check (
    public.current_user_can_submit_score(match_id)
    or public.current_user_can_admin_edit_score(match_id)
  );
