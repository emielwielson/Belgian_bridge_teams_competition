-- Scope resource CM checks to competition kinds / leagues / matches / clubs.
-- Catalog tables (seasons, regions, division_levels, vp_*): system_admin only.
-- players / player_auth_links: any competition manager (global or scoped) via role.

-- Catalog: system_admin only
drop policy if exists regions_manager_write on public.regions;
create policy regions_admin_write on public.regions
  for all to authenticated
  using (public.current_user_is_system_admin())
  with check (public.current_user_is_system_admin());

drop policy if exists seasons_manager_write on public.seasons;
create policy seasons_admin_write on public.seasons
  for all to authenticated
  using (public.current_user_is_system_admin())
  with check (public.current_user_is_system_admin());

drop policy if exists division_levels_manager_write on public.division_levels;
create policy division_levels_admin_write on public.division_levels
  for all to authenticated
  using (public.current_user_is_system_admin())
  with check (public.current_user_is_system_admin());

drop policy if exists vp_tables_manager_write on public.vp_tables;
drop policy if exists vp_tables_admin_write on public.vp_tables;
create policy vp_tables_manager_write on public.vp_tables
  for all to authenticated
  using (public.current_user_manages_group(group_id))
  with check (public.current_user_manages_group(group_id));

drop policy if exists vp_table_rows_manager_write on public.vp_table_rows;
drop policy if exists vp_table_rows_admin_write on public.vp_table_rows;
create policy vp_table_rows_manager_write on public.vp_table_rows
  for all to authenticated
  using (
    exists (
      select 1
      from public.vp_tables vt
      where vt.id = vp_table_id
        and public.current_user_manages_group(vt.group_id)
    )
  )
  with check (
    exists (
      select 1
      from public.vp_tables vt
      where vt.id = vp_table_id
        and public.current_user_manages_group(vt.group_id)
    )
  );

-- Leagues / divisions / groups / matches: kind-scoped
drop policy if exists leagues_manager_write on public.leagues;
create policy leagues_manager_write on public.leagues
  for all to authenticated
  using (public.current_user_manages_league(id))
  with check (public.current_user_manages_competition_kind(competition_kind_id));

drop policy if exists divisions_manager_write on public.divisions;
create policy divisions_manager_write on public.divisions
  for all to authenticated
  using (public.current_user_manages_league(league_id))
  with check (public.current_user_manages_league(league_id));

drop policy if exists groups_manager_write on public.groups;
create policy groups_manager_write on public.groups
  for all to authenticated
  using (
    exists (
      select 1 from public.divisions d
      where d.id = division_id
        and public.current_user_manages_league(d.league_id)
    )
  )
  with check (
    exists (
      select 1 from public.divisions d
      where d.id = division_id
        and public.current_user_manages_league(d.league_id)
    )
  );

drop policy if exists matches_manager_write on public.matches;
create policy matches_manager_write on public.matches
  for all to authenticated
  using (public.current_user_manages_group(group_id))
  with check (public.current_user_manages_group(group_id));

drop policy if exists match_players_manager_write on public.match_players;
create policy match_players_manager_write on public.match_players
  for all to authenticated
  using (public.current_user_manages_match(match_id))
  with check (public.current_user_manages_match(match_id));

-- Clubs / teams: scoped
drop policy if exists clubs_manager_write on public.clubs;
drop policy if exists clubs_competition_manager_write on public.clubs;
create policy clubs_competition_manager_write on public.clubs
  for all to authenticated
  using (public.current_user_manages_club(id))
  with check (public.current_user_manages_club(id));

drop policy if exists player_club_memberships_manager_write on public.player_club_memberships;
drop policy if exists player_club_memberships_competition_manager_write on public.player_club_memberships;
create policy player_club_memberships_competition_manager_write on public.player_club_memberships
  for all to authenticated
  using (public.current_user_manages_club(club_id))
  with check (public.current_user_manages_club(club_id));

drop policy if exists teams_manager_write on public.teams;
drop policy if exists teams_competition_manager_write on public.teams;
create policy teams_competition_manager_write on public.teams
  for all to authenticated
  using (public.current_user_manages_group(group_id))
  with check (public.current_user_manages_group(group_id));

drop policy if exists team_players_manager_write on public.team_players;
drop policy if exists team_players_competition_manager_write on public.team_players;
create policy team_players_competition_manager_write on public.team_players
  for all to authenticated
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_id
        and public.current_user_manages_group(t.group_id)
    )
  )
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_id
        and public.current_user_manages_group(t.group_id)
    )
  );

-- players: any CM (role) — leave as is
-- player_auth_links: leave as is (any CM role)

-- competition_match_dates
drop policy if exists competition_match_dates_manager_write on public.competition_match_dates;
create policy competition_match_dates_manager_write on public.competition_match_dates
  for all to authenticated
  using (public.current_user_manages_competition_unit(scope, region_id))
  with check (public.current_user_manages_competition_unit(scope, region_id));

-- group bye / schedule / skipped rounds
drop policy if exists group_bye_rounds_admin_write on public.group_bye_rounds;
create policy group_bye_rounds_admin_write on public.group_bye_rounds
  for all to authenticated
  using (public.current_user_manages_group(group_id))
  with check (public.current_user_manages_group(group_id));

drop policy if exists group_schedule_slots_admin_write on public.group_schedule_slots;
create policy group_schedule_slots_admin_write on public.group_schedule_slots
  for all to authenticated
  using (public.current_user_manages_group(group_id))
  with check (public.current_user_manages_group(group_id));

drop policy if exists group_skipped_match_rounds_admin_write on public.group_skipped_match_rounds;
create policy group_skipped_match_rounds_admin_write on public.group_skipped_match_rounds
  for all to authenticated
  using (public.current_user_manages_group(group_id))
  with check (public.current_user_manages_group(group_id));

-- Discipline: arbiters global; CM team/match-scoped
drop policy if exists penalties_discipline_write on public.penalties;
create policy penalties_discipline_write on public.penalties
  for all to authenticated
  using (
    public.current_user_is_arbiter()
    or public.current_user_manages_team(team_id)
  )
  with check (
    public.current_user_is_arbiter()
    or public.current_user_manages_team(team_id)
  );

drop policy if exists warnings_discipline_write on public.warnings;
create policy warnings_discipline_write on public.warnings
  for all to authenticated
  using (
    public.current_user_is_arbiter()
    or public.current_user_manages_team(team_id)
  )
  with check (
    public.current_user_is_arbiter()
    or public.current_user_manages_team(team_id)
  );

drop policy if exists rulings_discipline_write on public.rulings;
create policy rulings_discipline_write on public.rulings
  for all to authenticated
  using (
    public.current_user_is_arbiter()
    or public.current_user_manages_match(match_id)
  )
  with check (
    public.current_user_is_arbiter()
    or public.current_user_manages_match(match_id)
  );

drop policy if exists match_logs_manager_read on public.match_logs;
create policy match_logs_manager_read on public.match_logs
  for select to authenticated
  using (public.current_user_manages_match(match_id));

drop policy if exists match_logs_manager_insert on public.match_logs;
create policy match_logs_manager_insert on public.match_logs
  for insert to authenticated
  with check (public.current_user_manages_match(match_id));

-- Postponement / home-away / arbiter request manager read policies
drop policy if exists match_postponement_requests_manager_read on public.match_postponement_requests;
create policy match_postponement_requests_manager_read on public.match_postponement_requests
  for select to authenticated
  using (public.current_user_manages_match(match_id));

drop policy if exists match_home_away_switch_requests_manager_read on public.match_home_away_switch_requests;
create policy match_home_away_switch_requests_manager_read on public.match_home_away_switch_requests
  for select to authenticated
  using (public.current_user_manages_match(match_id));

drop policy if exists arbiter_requests_arbiter_update on public.arbiter_requests;
create policy arbiter_requests_arbiter_update on public.arbiter_requests
  for update to authenticated
  using (
    public.current_user_is_arbiter()
    or public.current_user_manages_match(match_id)
  )
  with check (
    public.current_user_is_arbiter()
    or public.current_user_manages_match(match_id)
  );


create or replace function public.current_user_can_admin_edit_score(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_manages_match(p_match_id)
    or public.current_user_is_arbiter();
$$;

create or replace function public.current_user_can_submit_score(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_manages_match(p_match_id)
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
        public.current_user_manages_match(p_match_id)
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
  select public.current_user_can_submit_score(p_match_id)
    or public.current_user_is_arbiter()
    or public.current_user_manages_match(p_match_id);
$$;

create or replace function public.current_user_can_manage_team_convention_cards(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_manages_team(p_team_id)
    or public.current_user_on_team(p_team_id);
$$;

create or replace function public.current_user_can_view_match_postponement(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_manages_match(p_match_id)
    or exists (
      select 1
      from public.matches m
      where m.id = p_match_id
        and (
          public.current_user_is_captain_of_team(m.home_team_id)
          or public.current_user_is_captain_of_team(m.away_team_id)
        )
    );
$$;

create or replace function public.current_user_can_view_match_home_away_switch(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_manages_match(p_match_id)
    or exists (
      select 1
      from public.matches m
      where m.id = p_match_id
        and (
          public.current_user_is_captain_of_team(m.home_team_id)
          or public.current_user_is_captain_of_team(m.away_team_id)
        )
    );
$$;

create or replace function public.current_user_can_view_match_arbiter_requests(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_manages_match(p_match_id)
    or public.current_user_is_arbiter()
    or public.current_user_can_submit_score(p_match_id);
$$;

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
    and not (
      public.current_user_manages_match(coalesce(new.id, old.id))
      or public.current_user_is_arbiter()
    )
  then
    raise exception 'Score edits after match is played require arbiter or competition manager';
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

create or replace function public.arbiter_request_create(
  p_match_id uuid,
  p_image_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_request_id uuid;
  v_image_path text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_image_path := nullif(trim(p_image_path), '');
  if v_image_path is null then
    raise exception 'Attachment is required';
  end if;

  select * into v_match
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if not public.current_user_can_submit_score(p_match_id) then
    raise exception 'Forbidden: cannot submit arbiter request for this match';
  end if;

  insert into public.arbiter_requests (
    match_id,
    description,
    image_path,
    status,
    submitted_by
  )
  values (
    p_match_id,
    null,
    v_image_path,
    'open',
    auth.uid()
  )
  returning id into v_request_id;

  insert into public.match_logs (match_id, action, user_id)
  values (p_match_id, 'arbiter_request_created', auth.uid());

  return v_request_id;
end;
$$;

create or replace function public.get_match_arbiter_requests_state(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_requests jsonb;
  v_can_submit boolean := false;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if not found then
    return null;
  end if;

  if not public.current_user_can_view_match_arbiter_requests(p_match_id) then
    raise exception 'Forbidden';
  end if;

  v_can_submit := public.current_user_can_submit_score(p_match_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'description', r.description,
      'image_path', r.image_path,
      'status', r.status,
      'created_at', r.created_at,
      'resolved_at', r.resolved_at
    )
    order by r.created_at desc
  ), '[]'::jsonb)
  into v_requests
  from public.arbiter_requests r
  where r.match_id = p_match_id;

  return jsonb_build_object(
    'match_id', v_match.id,
    'can_submit', v_can_submit,
    'requests', v_requests
  );
end;
$$;

create or replace function public.propose_match_postponement(
  p_match_id uuid,
  p_proposed_datetime timestamptz,
  p_proposing_team_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_match
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if v_match.played_at is not null then
    raise exception 'Cannot postpone a match that has been played';
  end if;

  if public.match_has_pending_home_away_switch(p_match_id) then
    raise exception 'A home/away switch request is already pending for this match';
  end if;

  if exists (
    select 1
    from public.match_postponement_requests r
    where r.match_id = p_match_id
      and r.status = 'pending'
  ) then
    raise exception 'A postponement request is already pending for this match';
  end if;

  if p_proposing_team_id not in (v_match.home_team_id, v_match.away_team_id) then
    raise exception 'Proposing team must be home or away for this match';
  end if;

  if not (
    public.current_user_is_captain_of_team(p_proposing_team_id)
    or public.current_user_manages_match(p_match_id)
  ) then
    raise exception 'Only the team captain or a competition manager may propose a postponement';
  end if;

  insert into public.match_postponement_requests (
    match_id,
    status,
    proposed_datetime,
    proposing_team_id,
    proposed_by
  )
  values (
    p_match_id,
    'pending',
    p_proposed_datetime,
    p_proposing_team_id,
    auth.uid()
  )
  returning id into v_request_id;

  insert into public.match_logs (match_id, action, user_id)
  values (p_match_id, 'postponement_proposed', auth.uid());

  return v_request_id;
end;
$$;

create or replace function public.respond_match_postponement(
  p_request_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.match_postponement_requests%rowtype;
  v_match public.matches%rowtype;
  v_other_team_id uuid;
  v_log_action text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_action not in ('approve', 'reject', 'cancel') then
    raise exception 'Invalid action: %', p_action;
  end if;

  select * into v_request
  from public.match_postponement_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'Postponement request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Postponement request is no longer pending';
  end if;

  select * into v_match
  from public.matches m
  where m.id = v_request.match_id
  for update;

  if v_match.played_at is not null then
    raise exception 'Cannot respond to postponement for a played match';
  end if;

  if v_request.proposing_team_id = v_match.home_team_id then
    v_other_team_id := v_match.away_team_id;
  else
    v_other_team_id := v_match.home_team_id;
  end if;

  if p_action = 'cancel' then
    if not public.current_user_is_captain_of_team(v_request.proposing_team_id) then
      raise exception 'Only the proposing captain may cancel this request';
    end if;

    update public.match_postponement_requests
    set
      status = 'cancelled',
      responded_by = auth.uid(),
      responded_at = now()
    where id = p_request_id;

    v_log_action := 'postponement_cancelled';
  elsif p_action in ('approve', 'reject') then
    if not (
      public.current_user_is_captain_of_team(v_other_team_id)
      or public.current_user_manages_match(v_match.id)
    ) then
      raise exception 'Only the opposing team captain or a competition manager may approve or reject';
    end if;

    if p_action = 'approve' then
      update public.matches
      set datetime = v_request.proposed_datetime
      where id = v_match.id;

      update public.match_postponement_requests
      set
        status = 'approved',
        responded_by = auth.uid(),
        responded_at = now()
      where id = p_request_id;

      v_log_action := 'postponement_approved';
    else
      update public.match_postponement_requests
      set
        status = 'rejected',
        responded_by = auth.uid(),
        responded_at = now()
      where id = p_request_id;

      v_log_action := 'postponement_rejected';
    end if;
  end if;

  insert into public.match_logs (match_id, action, user_id)
  values (v_match.id, v_log_action, auth.uid());
end;
$$;

create or replace function public.get_match_postponement_state(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_pending public.match_postponement_requests%rowtype;
  v_home_captain boolean;
  v_away_captain boolean;
  v_other_team_id uuid;
  v_can_propose boolean := false;
  v_can_approve boolean := false;
  v_can_reject boolean := false;
  v_can_cancel boolean := false;
  v_captain_teams uuid[] := array[]::uuid[];
begin
  select * into v_match
  from public.matches m
  where m.id = p_match_id;

  if not found then
    return null;
  end if;

  v_home_captain := public.current_user_is_captain_of_team(v_match.home_team_id);
  v_away_captain := public.current_user_is_captain_of_team(v_match.away_team_id);

  if v_home_captain then
    v_captain_teams := array_append(v_captain_teams, v_match.home_team_id);
  end if;
  if v_away_captain then
    v_captain_teams := array_append(v_captain_teams, v_match.away_team_id);
  end if;

  select * into v_pending
  from public.match_postponement_requests r
  where r.match_id = p_match_id
    and r.status = 'pending'
  limit 1;

  if v_match.played_at is null
    and v_pending.id is null
    and not public.match_has_pending_home_away_switch(p_match_id)
  then
    if v_home_captain or v_away_captain then
      v_can_propose := true;
    elsif public.current_user_manages_match(p_match_id) then
      v_can_propose := true;
      v_captain_teams := array[v_match.home_team_id, v_match.away_team_id];
    end if;
  end if;

  if v_pending.id is not null then
    if v_pending.proposing_team_id = v_match.home_team_id then
      v_other_team_id := v_match.away_team_id;
    else
      v_other_team_id := v_match.home_team_id;
    end if;

    if public.current_user_is_captain_of_team(v_other_team_id) then
      v_can_approve := true;
      v_can_reject := true;
    end if;

    if public.current_user_manages_match(p_match_id) then
      v_can_approve := true;
      v_can_reject := true;
    end if;

    if public.current_user_is_captain_of_team(v_pending.proposing_team_id) then
      v_can_cancel := true;
    end if;
  end if;

  return jsonb_build_object(
    'match_id', v_match.id,
    'datetime', v_match.datetime,
    'played_at', v_match.played_at,
    'home_team_id', v_match.home_team_id,
    'away_team_id', v_match.away_team_id,
    'captain_teams', to_jsonb(v_captain_teams),
    'can_propose', v_can_propose,
    'can_approve', v_can_approve,
    'can_reject', v_can_reject,
    'can_cancel', v_can_cancel,
    'pending', case
      when v_pending.id is null then null
      else jsonb_build_object(
        'id', v_pending.id,
        'proposed_datetime', v_pending.proposed_datetime,
        'proposing_team_id', v_pending.proposing_team_id,
        'proposed_by', v_pending.proposed_by,
        'created_at', v_pending.created_at
      )
    end
  );
end;
$$;

create or replace function public.respond_match_home_away_switch(
  p_request_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.match_home_away_switch_requests%rowtype;
  v_match public.matches%rowtype;
  v_other_team_id uuid;
  v_log_action text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_action not in ('approve', 'reject', 'cancel') then
    raise exception 'Invalid action: %', p_action;
  end if;

  select * into v_request
  from public.match_home_away_switch_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'Home/away switch request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Home/away switch request is no longer pending';
  end if;

  select * into v_match
  from public.matches m
  where m.id = v_request.match_id
  for update;

  if v_match.played_at is not null then
    raise exception 'Cannot respond to home/away switch for a played match';
  end if;

  if v_request.requesting_team_id = v_match.home_team_id then
    v_other_team_id := v_match.away_team_id;
  else
    v_other_team_id := v_match.home_team_id;
  end if;

  if p_action = 'cancel' then
    if not public.current_user_is_captain_of_team(v_request.requesting_team_id) then
      raise exception 'Only the proposing captain may cancel this request';
    end if;

    update public.match_home_away_switch_requests
    set
      status = 'cancelled',
      responded_by = auth.uid(),
      responded_at = now()
    where id = p_request_id;

    v_log_action := 'home_away_switch_cancelled';
  elsif p_action in ('approve', 'reject') then
    if not (
      public.current_user_is_captain_of_team(v_other_team_id)
      or public.current_user_manages_match(v_match.id)
    ) then
      raise exception 'Only the opposing team captain or a competition manager may approve or reject';
    end if;

    if p_action = 'approve' then
      update public.matches
      set
        hosting_team_id = case
          when v_match.hosting_team_id = v_match.home_team_id then v_match.away_team_id
          else v_match.home_team_id
        end
      where id = v_match.id;

      update public.match_home_away_switch_requests
      set
        status = 'approved',
        responded_by = auth.uid(),
        responded_at = now()
      where id = p_request_id;

      v_log_action := 'home_away_switch_approved';
    else
      update public.match_home_away_switch_requests
      set
        status = 'rejected',
        responded_by = auth.uid(),
        responded_at = now()
      where id = p_request_id;

      v_log_action := 'home_away_switch_rejected';
    end if;
  end if;

  insert into public.match_logs (match_id, action, user_id)
  values (v_match.id, v_log_action, auth.uid());
end;
$$;

create or replace function public.get_match_home_away_switch_state(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_ctx jsonb;
  v_pending public.match_home_away_switch_requests%rowtype;
  v_home_captain boolean;
  v_away_captain boolean;
  v_other_team_id uuid;
  v_can_propose boolean := false;
  v_can_approve boolean := false;
  v_can_reject boolean := false;
  v_can_cancel boolean := false;
  v_captain_teams uuid[] := array[]::uuid[];
  v_needs_switch boolean := false;
  v_is_mirror_round boolean := false;
begin
  select * into v_match
  from public.matches m
  where m.id = p_match_id;

  if not found then
    return null;
  end if;

  v_ctx := public.match_mirror_switch_context(p_match_id);
  v_needs_switch := coalesce((v_ctx->>'needs_switch')::boolean, false);
  v_is_mirror_round := coalesce((v_ctx->>'is_mirror_round')::boolean, false);

  v_home_captain := public.current_user_is_captain_of_team(v_match.home_team_id);
  v_away_captain := public.current_user_is_captain_of_team(v_match.away_team_id);

  if v_home_captain then
    v_captain_teams := array_append(v_captain_teams, v_match.home_team_id);
  end if;
  if v_away_captain then
    v_captain_teams := array_append(v_captain_teams, v_match.away_team_id);
  end if;

  select * into v_pending
  from public.match_home_away_switch_requests r
  where r.match_id = p_match_id
    and r.status = 'pending'
  limit 1;

  if v_match.played_at is null
    and v_pending.id is null
    and not public.match_has_pending_postponement(p_match_id)
  then
    if v_home_captain or v_away_captain then
      v_can_propose := true;
    end if;
  end if;

  if v_pending.id is not null then
    if v_pending.requesting_team_id = v_match.home_team_id then
      v_other_team_id := v_match.away_team_id;
    else
      v_other_team_id := v_match.home_team_id;
    end if;

    if public.current_user_is_captain_of_team(v_other_team_id) then
      v_can_approve := true;
      v_can_reject := true;
    end if;

    if public.current_user_manages_match(p_match_id) then
      v_can_approve := true;
      v_can_reject := true;
    end if;

    if public.current_user_is_captain_of_team(v_pending.requesting_team_id) then
      v_can_cancel := true;
    end if;
  end if;

  return jsonb_build_object(
    'match_id', v_match.id,
    'round', v_match.round,
    'played_at', v_match.played_at,
    'home_team_id', v_match.home_team_id,
    'away_team_id', v_match.away_team_id,
    'hosting_team_id', v_match.hosting_team_id,
    'captain_teams', to_jsonb(v_captain_teams),
    'needs_switch', v_needs_switch,
    'is_mirror_round', v_is_mirror_round,
    'first_leg_round', v_ctx->'first_leg_round',
    'first_leg', v_ctx->'first_leg',
    'can_propose', v_can_propose,
    'can_approve', v_can_approve,
    'can_reject', v_can_reject,
    'can_cancel', v_can_cancel,
    'pending', case
      when v_pending.id is null then null
      else jsonb_build_object(
        'id', v_pending.id,
        'requesting_team_id', v_pending.requesting_team_id,
        'proposed_by', v_pending.proposed_by,
        'created_at', v_pending.created_at
      )
    end
  );
end;
$$;

create or replace function public.arbiter_request_resolve(
  p_request_id uuid,
  p_ruling_file_path text,
  p_actions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.arbiter_requests%rowtype;
  v_match public.matches%rowtype;
  v_file_path text;
  v_ruling_id uuid;
  v_actions jsonb := coalesce(p_actions, '{}'::jsonb);
  v_score jsonb;
  v_imps_home numeric;
  v_imps_away numeric;
  v_mis_seating boolean;
  v_selected_board_count int;
  v_vp_board_count int;
  v_vp_home numeric;
  v_vp_away numeric;
  v_penalty jsonb;
  v_warning jsonb;
  v_team_id uuid;
  v_vp_deduction numeric;
  v_reason text;
  v_date date;
  v_penalty_ids uuid[] := '{}';
  v_warning_ids uuid[] := '{}';
  v_penalty_id uuid;
  v_warning_id uuid;
  v_score_result jsonb := null;
  v_log_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.current_user_is_arbiter()
    and not public.current_user_has_role('competition_manager')
    and not public.current_user_is_system_admin() then
    raise exception 'Only an arbiter or competition manager may resolve requests';
  end if;

  v_file_path := nullif(trim(p_ruling_file_path), '');
  if v_file_path is null then
    raise exception 'Ruling document is required';
  end if;

  select * into v_request
  from public.arbiter_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'Arbiter request not found';
  end if;

  if v_request.status <> 'open' then
    raise exception 'Arbiter request is already resolved';
  end if;

  select * into v_match
  from public.matches m
  where m.id = v_request.match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if not public.current_user_is_arbiter()
    and not public.current_user_manages_match(v_match.id) then
    raise exception 'Only an arbiter or competition manager may resolve requests';
  end if;

  insert into public.rulings (
    match_id,
    file_path,
    arbiter_request_id,
    created_by
  )
  values (
    v_request.match_id,
    v_file_path,
    p_request_id,
    auth.uid()
  )
  returning id into v_ruling_id;

  update public.arbiter_requests
  set
    status = 'resolved',
    resolved_by = auth.uid(),
    resolved_at = now(),
    updated_at = now()
  where id = p_request_id;

  insert into public.match_logs (match_id, action, user_id)
  values (v_request.match_id, 'ruling_created', auth.uid());

  -- Optional score change
  if v_actions ? 'score_change' and v_actions->'score_change' is not null
    and v_actions->'score_change' <> 'null'::jsonb then
    v_score := v_actions->'score_change';

    if v_match.played_at is null then
      raise exception 'Score change requires the match to have an official score';
    end if;

    v_imps_home := (v_score->>'imps_home')::numeric;
    v_imps_away := (v_score->>'imps_away')::numeric;
    if v_imps_home is null or v_imps_away is null then
      raise exception 'Score change requires imps_home and imps_away';
    end if;

    v_mis_seating := coalesce((v_score->>'mis_seating')::boolean, false);
    v_selected_board_count := nullif(v_score->>'selected_board_count', '')::int;
    v_vp_board_count := nullif(v_score->>'vp_board_count', '')::int;

    if v_vp_board_count is null or v_vp_board_count <= 0 then
      raise exception 'Score change requires a positive vp_board_count';
    end if;

    update public.matches
    set
      mis_seating = v_mis_seating,
      selected_board_count = v_selected_board_count,
      vp_board_count = v_vp_board_count
    where id = v_match.id;

    select l.vp_home, l.vp_away
    into v_vp_home, v_vp_away
    from public.lookup_vp_for_match(v_match.id, v_imps_home, v_imps_away) l;

    update public.matches
    set
      imps_home = v_imps_home,
      imps_away = v_imps_away,
      vp_home = v_vp_home,
      vp_away = v_vp_away,
      last_modified_by = auth.uid(),
      last_modified_at = now()
    where id = v_match.id;

    v_log_payload := jsonb_build_object(
      'imps_home', v_imps_home,
      'imps_away', v_imps_away,
      'vp_home', v_vp_home,
      'vp_away', v_vp_away,
      'vp_board_count', v_vp_board_count,
      'mis_seating', v_mis_seating,
      'selected_board_count', v_selected_board_count,
      'previous', jsonb_build_object(
        'imps_home', v_match.imps_home,
        'imps_away', v_match.imps_away,
        'vp_home', v_match.vp_home,
        'vp_away', v_match.vp_away
      )
    );

    insert into public.match_logs (match_id, action, user_id)
    values (
      v_request.match_id,
      'score_arbiter_edit:' || v_log_payload::text,
      auth.uid()
    );

    v_score_result := jsonb_build_object(
      'imps_home', v_imps_home,
      'imps_away', v_imps_away,
      'vp_home', v_vp_home,
      'vp_away', v_vp_away,
      'vp_board_count', v_vp_board_count,
      'mis_seating', v_mis_seating,
      'selected_board_count', v_selected_board_count
    );
  end if;

  -- Optional penalties
  if jsonb_typeof(v_actions->'penalties') = 'array' then
    for v_penalty in
      select value from jsonb_array_elements(v_actions->'penalties') as t(value)
    loop
      v_team_id := nullif(v_penalty->>'team_id', '')::uuid;
      v_reason := nullif(trim(v_penalty->>'reason'), '');
      v_vp_deduction := coalesce((v_penalty->>'vp_deduction')::numeric, 0);
      v_date := nullif(v_penalty->>'penalty_date', '')::date;

      if v_team_id is null or v_reason is null or v_date is null then
        raise exception 'Each penalty requires team_id, penalty_date, and reason';
      end if;

      if v_team_id not in (v_match.home_team_id, v_match.away_team_id) then
        raise exception 'Penalty team must be the home or away team of the match';
      end if;

      if v_vp_deduction < 0 then
        raise exception 'Penalty vp_deduction must be non-negative';
      end if;

      insert into public.penalties (
        team_id,
        penalty_date,
        reason,
        vp_deduction,
        arbiter_request_id,
        created_by
      )
      values (
        v_team_id,
        v_date,
        v_reason,
        v_vp_deduction,
        p_request_id,
        auth.uid()
      )
      returning id into v_penalty_id;

      v_penalty_ids := array_append(v_penalty_ids, v_penalty_id);

      insert into public.match_logs (match_id, action, user_id)
      values (
        v_request.match_id,
        'penalty_created:' || jsonb_build_object(
          'penalty_id', v_penalty_id,
          'team_id', v_team_id,
          'vp_deduction', v_vp_deduction
        )::text,
        auth.uid()
      );
    end loop;
  end if;

  -- Optional warnings
  if jsonb_typeof(v_actions->'warnings') = 'array' then
    for v_warning in
      select value from jsonb_array_elements(v_actions->'warnings') as t(value)
    loop
      v_team_id := nullif(v_warning->>'team_id', '')::uuid;
      v_reason := nullif(trim(v_warning->>'reason'), '');
      v_date := nullif(v_warning->>'warning_date', '')::date;

      if v_team_id is null or v_reason is null or v_date is null then
        raise exception 'Each warning requires team_id, warning_date, and reason';
      end if;

      if v_team_id not in (v_match.home_team_id, v_match.away_team_id) then
        raise exception 'Warning team must be the home or away team of the match';
      end if;

      insert into public.warnings (
        team_id,
        warning_date,
        reason,
        arbiter_request_id,
        created_by
      )
      values (
        v_team_id,
        v_date,
        v_reason,
        p_request_id,
        auth.uid()
      )
      returning id into v_warning_id;

      v_warning_ids := array_append(v_warning_ids, v_warning_id);

      insert into public.match_logs (match_id, action, user_id)
      values (
        v_request.match_id,
        'warning_created:' || jsonb_build_object(
          'warning_id', v_warning_id,
          'team_id', v_team_id
        )::text,
        auth.uid()
      );
    end loop;
  end if;

  insert into public.match_logs (match_id, action, user_id)
  values (v_request.match_id, 'arbiter_request_resolved', auth.uid());

  return jsonb_build_object(
    'ruling_id', v_ruling_id,
    'score', v_score_result,
    'penalty_ids', to_jsonb(v_penalty_ids),
    'warning_ids', to_jsonb(v_warning_ids)
  );
end;
$$;
