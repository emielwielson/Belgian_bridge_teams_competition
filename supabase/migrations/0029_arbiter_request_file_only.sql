-- Arbiter requests: file-only submission (board/description optional for legacy rows).

alter table public.arbiter_requests
  alter column board drop not null,
  alter column description drop not null;

alter table public.arbiter_requests
  drop constraint if exists arbiter_requests_description_nonempty;

alter table public.arbiter_requests
  drop constraint if exists arbiter_requests_board_positive;

alter table public.arbiter_requests
  add constraint arbiter_requests_board_positive_when_set
    check (board is null or board > 0);

-- image_path required for new requests is enforced in arbiter_request_create (legacy rows may have null).

drop function if exists public.arbiter_request_create(uuid, int, text, text);

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
    board,
    description,
    image_path,
    status,
    submitted_by
  )
  values (
    p_match_id,
    null,
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
      'board', r.board,
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

grant execute on function public.arbiter_request_create(uuid, text) to authenticated;
