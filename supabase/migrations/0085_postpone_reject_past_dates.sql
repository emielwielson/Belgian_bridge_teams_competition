-- Reject postponement proposals whose Brussels calendar date is before today.
-- Today (any clock time) remains allowed.

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

  if (p_proposed_datetime at time zone 'Europe/Brussels')::date
     < (now() at time zone 'Europe/Brussels')::date then
    raise exception 'Proposed datetime cannot be in the past';
  end if;

  if public.match_has_pending_location_change(p_match_id) then
    raise exception 'A location change request is already pending for this match';
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
