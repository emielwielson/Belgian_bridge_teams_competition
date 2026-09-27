-- Allow competition managers to cancel open arbiter requests.

alter table public.arbiter_requests
  drop constraint if exists arbiter_requests_status_check;

alter table public.arbiter_requests
  add constraint arbiter_requests_status_check
  check (status in ('open', 'resolved', 'cancelled'));

create or replace function public.arbiter_request_cancel(p_request_id uuid)
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

  if not public.current_user_has_role('competition_manager')
    and not public.current_user_is_system_admin() then
    raise exception 'Only a competition manager may cancel requests';
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

  if not public.current_user_manages_match(v_request.match_id) then
    raise exception 'Only a competition manager may cancel requests';
  end if;

  update public.arbiter_requests
  set status = 'cancelled'
  where id = p_request_id;

  insert into public.match_logs (match_id, action, user_id)
  values (v_request.match_id, 'arbiter_request_cancelled', auth.uid());
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
      'can_cancel', v_can_cancel and r.status = 'open'
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

grant execute on function public.arbiter_request_cancel(uuid) to authenticated;
