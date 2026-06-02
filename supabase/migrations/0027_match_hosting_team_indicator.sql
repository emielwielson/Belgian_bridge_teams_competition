-- Persist host side independently from home_team_id/away_team_id.
-- Home/away switch approvals now toggle hosting_team_id only.

alter table public.matches
  add column if not exists hosting_team_id uuid;

update public.matches
set hosting_team_id = home_team_id
where hosting_team_id is null;

alter table public.matches
  alter column hosting_team_id set not null;

alter table public.matches
  drop constraint if exists matches_hosting_team_fk;

alter table public.matches
  add constraint matches_hosting_team_fk
    foreign key (hosting_team_id) references public.teams (id) on delete restrict;

alter table public.matches
  drop constraint if exists matches_hosting_team_membership_check;

alter table public.matches
  add constraint matches_hosting_team_membership_check
    check (hosting_team_id = home_team_id or hosting_team_id = away_team_id);

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
  v_ctx jsonb;
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

  v_ctx := public.match_mirror_switch_context(v_match.id);
  if v_ctx is null or not coalesce((v_ctx->>'eligible')::boolean, false) then
    raise exception 'Home/away switch is no longer valid for this match';
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
    if not public.current_user_is_captain_of_team(v_other_team_id) then
      raise exception 'Only the opposing team captain may approve or reject';
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
  v_eligible boolean := false;
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
  v_eligible := coalesce((v_ctx->>'eligible')::boolean, false);

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
    and v_eligible
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
