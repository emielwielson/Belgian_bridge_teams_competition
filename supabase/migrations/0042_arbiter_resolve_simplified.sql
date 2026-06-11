-- Simplify arbiter resolve: ruling document only; drop legacy arbiter_requests.board.

alter table public.arbiter_requests
  drop constraint if exists arbiter_requests_board_positive_when_set;

alter table public.arbiter_requests
  drop column if exists board;

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
  ) then
    raise exception 'Only a team captain may submit an arbiter request';
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
    or public.current_user_is_captain_of_team(v_match.away_team_id);

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

drop function if exists public.arbiter_request_resolve(uuid, text, int, date);

create or replace function public.arbiter_request_resolve(
  p_request_id uuid,
  p_ruling_file_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.arbiter_requests%rowtype;
  v_file_path text;
  v_ruling_id uuid;
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

  insert into public.match_logs (match_id, action, user_id)
  values (v_request.match_id, 'arbiter_request_resolved', auth.uid());

  return v_ruling_id;
end;
$$;

grant execute on function public.arbiter_request_resolve(uuid, text) to authenticated;
