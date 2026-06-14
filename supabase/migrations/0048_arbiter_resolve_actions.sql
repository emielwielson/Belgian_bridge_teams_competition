-- Arbiter resolve: optional score change, penalties, and warnings during resolution

alter table public.penalties
  add column if not exists arbiter_request_id uuid references public.arbiter_requests (id) on delete set null;

alter table public.warnings
  add column if not exists arbiter_request_id uuid references public.arbiter_requests (id) on delete set null;

drop policy if exists warnings_manager_write on public.warnings;

create policy warnings_discipline_write on public.warnings
  for all to authenticated
  using (
    public.current_user_is_competition_manager()
    or public.current_user_is_arbiter()
  )
  with check (
    public.current_user_is_competition_manager()
    or public.current_user_is_arbiter()
  );

drop function if exists public.arbiter_request_resolve(uuid, text);

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
    and not public.current_user_is_competition_manager() then
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

grant execute on function public.arbiter_request_resolve(uuid, text, jsonb) to authenticated;
