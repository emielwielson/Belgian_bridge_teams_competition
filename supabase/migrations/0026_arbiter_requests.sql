-- Task 5.3: Arbiter requests (captain submit, arbiter resolve)

create table public.arbiter_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  board int not null,
  description text not null,
  image_path text,
  status text not null default 'open',
  submitted_by uuid references auth.users (id) on delete set null,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arbiter_requests_status_check check (status in ('open', 'resolved')),
  constraint arbiter_requests_board_positive check (board > 0),
  constraint arbiter_requests_description_nonempty check (char_length(trim(description)) > 0)
);

create index arbiter_requests_match_id_idx on public.arbiter_requests (match_id);
create index arbiter_requests_status_created_idx
  on public.arbiter_requests (status, created_at desc);

create or replace function public.current_user_can_view_match_arbiter_requests(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_competition_manager()
    or public.current_user_is_arbiter()
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

grant execute on function public.current_user_can_view_match_arbiter_requests(uuid) to authenticated;

create or replace function public.arbiter_request_create(
  p_match_id uuid,
  p_board int,
  p_description text,
  p_image_path text default null
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
  where m.id = p_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if p_board < 1 or p_board > v_match.board_count then
    raise exception 'Board must be between 1 and %', v_match.board_count;
  end if;

  if char_length(trim(p_description)) = 0 then
    raise exception 'Description is required';
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
    p_board,
    trim(p_description),
    nullif(trim(p_image_path), ''),
    'open',
    auth.uid()
  )
  returning id into v_request_id;

  insert into public.match_logs (match_id, action, user_id)
  values (p_match_id, 'arbiter_request_created', auth.uid());

  return v_request_id;
end;
$$;

create or replace function public.arbiter_request_resolve(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.arbiter_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.current_user_is_arbiter()
    and not public.current_user_is_competition_manager() then
    raise exception 'Only an arbiter or competition manager may resolve requests';
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

  update public.arbiter_requests
  set
    status = 'resolved',
    resolved_by = auth.uid(),
    resolved_at = now(),
    updated_at = now()
  where id = p_request_id;

  insert into public.match_logs (match_id, action, user_id)
  values (v_request.match_id, 'arbiter_request_resolved', auth.uid());
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
    'board_count', v_match.board_count,
    'can_submit', v_can_submit,
    'requests', v_requests
  );
end;
$$;

grant execute on function public.arbiter_request_create(uuid, int, text, text) to authenticated;
grant execute on function public.arbiter_request_resolve(uuid) to authenticated;
grant execute on function public.get_match_arbiter_requests_state(uuid) to authenticated;

alter table public.arbiter_requests enable row level security;

create policy arbiter_requests_select on public.arbiter_requests
  for select to authenticated
  using (public.current_user_can_view_match_arbiter_requests(match_id));

create policy arbiter_requests_arbiter_update on public.arbiter_requests
  for update to authenticated
  using (
    public.current_user_is_arbiter()
    or public.current_user_is_competition_manager()
  )
  with check (
    public.current_user_is_arbiter()
    or public.current_user_is_competition_manager()
  );
