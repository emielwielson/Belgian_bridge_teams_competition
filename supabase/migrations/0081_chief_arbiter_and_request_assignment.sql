-- Chief arbiter per competition kind + per-request arbiter assignment.
-- Initial request visibility/emails: competition managers + chief only.
-- Assigned arbiter can then view/resolve; chief and managers retain resolve access.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.arbiter_competition_scopes
  add column if not exists is_chief boolean not null default false;

create unique index if not exists arbiter_competition_scopes_one_chief_per_kind
  on public.arbiter_competition_scopes (competition_kind_id)
  where is_chief;

alter table public.arbiter_requests
  add column if not exists assigned_arbiter_id uuid references auth.users (id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid references auth.users (id) on delete set null;

create index if not exists arbiter_requests_assigned_arbiter_id_idx
  on public.arbiter_requests (assigned_arbiter_id)
  where assigned_arbiter_id is not null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_user_is_chief_arbiter_for_kind(p_kind_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_has_role('arbiter')
    and exists (
      select 1
      from public.arbiter_competition_scopes acs
      where acs.user_id = auth.uid()
        and acs.competition_kind_id = p_kind_id
        and acs.is_chief
    );
$$;

create or replace function public.current_user_is_chief_arbiter_for_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_has_role('arbiter')
    and exists (
      select 1
      from public.matches m
      join public.groups g on g.id = m.group_id
      join public.divisions d on d.id = g.division_id
      join public.leagues l on l.id = d.league_id
      join public.arbiter_competition_scopes acs
        on acs.user_id = auth.uid()
       and acs.competition_kind_id = l.competition_kind_id
       and acs.is_chief
      where m.id = p_match_id
    );
$$;

create or replace function public.current_user_can_staff_manage_arbiter_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.arbiter_requests r
    where r.id = p_request_id
      and (
        public.current_user_manages_match(r.match_id)
        or public.current_user_is_chief_arbiter_for_match(r.match_id)
      )
  );
$$;

create or replace function public.current_user_can_resolve_arbiter_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.arbiter_requests r
    where r.id = p_request_id
      and (
        public.current_user_manages_match(r.match_id)
        or public.current_user_is_chief_arbiter_for_match(r.match_id)
        or r.assigned_arbiter_id = auth.uid()
      )
  );
$$;

create or replace function public.current_user_can_view_arbiter_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.arbiter_requests r
    where r.id = p_request_id
      and (
        public.current_user_can_submit_score(r.match_id)
        or public.current_user_manages_match(r.match_id)
        or public.current_user_is_chief_arbiter_for_match(r.match_id)
        or r.assigned_arbiter_id = auth.uid()
      )
  );
$$;

-- Match-level gate: teams, managers, chiefs, assigned arbiters, or any
-- kind-scoped arbiter (who then sees an empty list if not assigned).
create or replace function public.current_user_can_view_match_arbiter_requests(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_manages_match(p_match_id)
    or public.current_user_is_chief_arbiter_for_match(p_match_id)
    or public.current_user_can_submit_score(p_match_id)
    or public.current_user_is_arbiter_for_match(p_match_id)
    or exists (
      select 1
      from public.arbiter_requests r
      where r.match_id = p_match_id
        and r.assigned_arbiter_id = auth.uid()
    );
$$;

create or replace function public.current_user_can_view_request_on_match(
  p_match_id uuid,
  p_assigned_arbiter_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_submit_score(p_match_id)
    or public.current_user_manages_match(p_match_id)
    or public.current_user_is_chief_arbiter_for_match(p_match_id)
    or (p_assigned_arbiter_id is not null and p_assigned_arbiter_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

drop policy if exists arbiter_requests_select on public.arbiter_requests;
create policy arbiter_requests_select on public.arbiter_requests
  for select to authenticated
  using (
    public.current_user_can_view_request_on_match(match_id, assigned_arbiter_id)
  );

drop policy if exists arbiter_requests_arbiter_update on public.arbiter_requests;
create policy arbiter_requests_arbiter_update on public.arbiter_requests
  for update to authenticated
  using (
    public.current_user_manages_match(match_id)
    or public.current_user_is_chief_arbiter_for_match(match_id)
    or assigned_arbiter_id = auth.uid()
  )
  with check (
    public.current_user_manages_match(match_id)
    or public.current_user_is_chief_arbiter_for_match(match_id)
    or assigned_arbiter_id = auth.uid()
  );

drop policy if exists arbiter_request_attachments_select
  on public.arbiter_request_attachments;
create policy arbiter_request_attachments_select
  on public.arbiter_request_attachments
  for select to authenticated
  using (
    public.current_user_can_view_arbiter_request(arbiter_request_id)
  );

-- Allow authenticated managers/admins to update is_chief via service or policies.
-- Admin UI uses the service role; keep select/insert/delete as today and add update
-- for users who can manage the arbiter kind.
drop policy if exists arbiter_competition_scopes_update on public.arbiter_competition_scopes;
create policy arbiter_competition_scopes_update on public.arbiter_competition_scopes
  for update to authenticated
  using (public.current_user_can_manage_arbiter_kind(competition_kind_id))
  with check (public.current_user_can_manage_arbiter_kind(competition_kind_id));

grant update on public.arbiter_competition_scopes to authenticated;

-- ---------------------------------------------------------------------------
-- Assign RPC
-- ---------------------------------------------------------------------------

create or replace function public.arbiter_request_assign(
  p_request_id uuid,
  p_arbiter_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.arbiter_requests%rowtype;
  v_kind_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_arbiter_user_id is null then
    raise exception 'Arbiter is required';
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

  if not public.current_user_manages_match(v_request.match_id)
    and not public.current_user_is_chief_arbiter_for_match(v_request.match_id) then
    raise exception 'Only a competition manager or chief arbiter may assign requests';
  end if;

  select l.competition_kind_id into v_kind_id
  from public.matches m
  join public.groups g on g.id = m.group_id
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where m.id = v_request.match_id;

  if v_kind_id is null then
    raise exception 'Match competition kind not found';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    join public.arbiter_competition_scopes acs
      on acs.user_id = ur.user_id
     and acs.competition_kind_id = v_kind_id
    where ur.user_id = p_arbiter_user_id
      and ur.role = 'arbiter'
  ) then
    raise exception 'Assignee must be an arbiter scoped to this competition';
  end if;

  update public.arbiter_requests
  set
    assigned_arbiter_id = p_arbiter_user_id,
    assigned_at = now(),
    assigned_by = auth.uid(),
    updated_at = now()
  where id = p_request_id;

  insert into public.match_logs (match_id, action, user_id)
  values (
    v_request.match_id,
    'arbiter_request_assigned:' || p_arbiter_user_id::text,
    auth.uid()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Resolve: managers, chief, or assigned arbiter only
-- ---------------------------------------------------------------------------

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

  if not public.current_user_has_role('arbiter')
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

  if not public.current_user_can_resolve_arbiter_request(p_request_id) then
    raise exception 'Only a competition manager, chief arbiter, or assigned arbiter may resolve requests';
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

-- ---------------------------------------------------------------------------
-- Match state: filter requests by visibility; include assignment fields
-- ---------------------------------------------------------------------------

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
  v_can_cancel boolean := false;
begin
  select * into v_match from public.matches m where m.id = p_match_id;
  if not found then
    return null;
  end if;

  if not public.current_user_can_view_match_arbiter_requests(p_match_id) then
    raise exception 'Forbidden';
  end if;

  v_can_submit := public.current_user_can_submit_score(p_match_id);
  v_can_cancel := public.current_user_manages_match(p_match_id);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'description', r.description,
      'image_path', r.image_path,
      'attachments', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'storage_path', a.storage_path,
            'sort_order', a.sort_order
          )
          order by a.sort_order, a.created_at
        )
        from public.arbiter_request_attachments a
        where a.arbiter_request_id = r.id
      ), '[]'::jsonb),
      'status', r.status,
      'created_at', r.created_at,
      'resolved_at', r.resolved_at,
      'assigned_arbiter_id', r.assigned_arbiter_id,
      'assigned_at', r.assigned_at,
      'can_cancel', v_can_cancel and r.status = 'open'
    )
    order by r.created_at desc
  ), '[]'::jsonb)
  into v_requests
  from public.arbiter_requests r
  where r.match_id = p_match_id
    and public.current_user_can_view_request_on_match(
      p_match_id,
      r.assigned_arbiter_id
    );

  return jsonb_build_object(
    'match_id', v_match.id,
    'can_submit', v_can_submit,
    'requests', v_requests
  );
end;
$$;

grant execute on function public.current_user_is_chief_arbiter_for_kind(uuid)
  to anon, authenticated;
grant execute on function public.current_user_is_chief_arbiter_for_match(uuid)
  to anon, authenticated;
grant execute on function public.current_user_can_staff_manage_arbiter_request(uuid)
  to anon, authenticated;
grant execute on function public.current_user_can_resolve_arbiter_request(uuid)
  to anon, authenticated;
grant execute on function public.current_user_can_view_arbiter_request(uuid)
  to anon, authenticated;
grant execute on function public.current_user_can_view_request_on_match(uuid, uuid)
  to anon, authenticated;
grant execute on function public.arbiter_request_assign(uuid, uuid) to authenticated;
