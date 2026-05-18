-- Task 5.1: Match postponement (captain propose, opposing captain approve)

create table public.match_postponement_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  status text not null default 'pending',
  proposed_datetime timestamptz not null,
  proposing_team_id uuid not null references public.teams (id) on delete restrict,
  proposed_by uuid references auth.users (id) on delete set null,
  responded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint match_postponement_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);

create unique index match_postponement_requests_one_pending_per_match
  on public.match_postponement_requests (match_id)
  where status = 'pending';

create index match_postponement_requests_match_id_idx
  on public.match_postponement_requests (match_id);

create or replace function public.current_user_is_captain_of_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = p_team_id
      and t.captain_id = public.current_user_player_id()
      and public.current_user_player_id() is not null
  );
$$;

create or replace function public.current_user_can_view_match_postponement(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_competition_manager()
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

  if not public.current_user_is_captain_of_team(p_proposing_team_id) then
    raise exception 'Only the team captain may propose a postponement';
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
  values (
    p_match_id,
    'postponement_proposed',
    auth.uid()
  );

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
    if not public.current_user_is_captain_of_team(v_other_team_id) then
      raise exception 'Only the opposing team captain may approve or reject';
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

  if v_match.played_at is null and v_pending.id is null then
    if v_home_captain or v_away_captain then
      v_can_propose := true;
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

grant execute on function public.current_user_is_captain_of_team(uuid) to authenticated;
grant execute on function public.current_user_can_view_match_postponement(uuid) to authenticated;
grant execute on function public.propose_match_postponement(uuid, timestamptz, uuid) to authenticated;
grant execute on function public.respond_match_postponement(uuid, text) to authenticated;
grant execute on function public.get_match_postponement_state(uuid) to authenticated;

alter table public.match_postponement_requests enable row level security;

create policy match_postponement_requests_read on public.match_postponement_requests
  for select to authenticated
  using (public.current_user_can_view_match_postponement(match_id));

create policy match_postponement_requests_manager_read on public.match_postponement_requests
  for select to authenticated
  using (public.current_user_is_competition_manager());
