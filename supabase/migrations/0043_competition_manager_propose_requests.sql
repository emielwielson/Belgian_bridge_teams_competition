-- Competition managers may propose arbiter requests and match postponements.

create or replace function public.current_user_can_view_match_ops(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_submit_score(p_match_id)
    or public.current_user_is_arbiter()
    or public.current_user_is_competition_manager();
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

  if not (
    public.current_user_is_captain_of_team(v_match.home_team_id)
    or public.current_user_is_captain_of_team(v_match.away_team_id)
    or public.current_user_is_competition_manager()
  ) then
    raise exception 'Only a team captain or competition manager may submit an arbiter request';
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

  v_can_submit :=
    public.current_user_is_captain_of_team(v_match.home_team_id)
    or public.current_user_is_captain_of_team(v_match.away_team_id)
    or public.current_user_is_competition_manager();

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
    or public.current_user_is_competition_manager()
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
    elsif public.current_user_is_competition_manager() then
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

    if public.current_user_is_competition_manager() then
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
