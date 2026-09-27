-- Multi-file attachments for arbiter requests (max 5 per request).

create table public.arbiter_request_attachments (
  id uuid primary key default gen_random_uuid(),
  arbiter_request_id uuid not null
    references public.arbiter_requests (id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint arbiter_request_attachments_path_nonempty
    check (char_length(trim(storage_path)) > 0),
  constraint arbiter_request_attachments_sort_nonnegative
    check (sort_order >= 0),
  constraint arbiter_request_attachments_request_path_unique
    unique (arbiter_request_id, storage_path)
);

create index arbiter_request_attachments_request_id_idx
  on public.arbiter_request_attachments (arbiter_request_id);

create index arbiter_request_attachments_request_sort_idx
  on public.arbiter_request_attachments (arbiter_request_id, sort_order);

alter table public.arbiter_request_attachments enable row level security;

create policy arbiter_request_attachments_select
  on public.arbiter_request_attachments
  for select to authenticated
  using (
    exists (
      select 1
      from public.arbiter_requests r
      where r.id = arbiter_request_id
        and public.current_user_can_view_match_arbiter_requests(r.match_id)
    )
  );

-- Backfill from legacy single image_path.
insert into public.arbiter_request_attachments (
  arbiter_request_id,
  storage_path,
  sort_order
)
select
  r.id,
  trim(r.image_path),
  0
from public.arbiter_requests r
where r.image_path is not null
  and char_length(trim(r.image_path)) > 0
on conflict (arbiter_request_id, storage_path) do nothing;

drop function if exists public.arbiter_request_create(uuid, text);

create or replace function public.arbiter_request_create(
  p_match_id uuid,
  p_image_paths text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_request_id uuid;
  v_paths text[];
  v_path text;
  v_i int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(array_agg(x.path order by x.ord), array[]::text[])
  into v_paths
  from (
    select trim(p) as path, min(ord) as ord
    from unnest(coalesce(p_image_paths, array[]::text[]))
      with ordinality as u(p, ord)
    where nullif(trim(p), '') is not null
    group by trim(p)
  ) x;

  if v_paths is null or cardinality(v_paths) = 0 then
    raise exception 'Attachment is required';
  end if;

  if cardinality(v_paths) > 5 then
    raise exception 'At most 5 attachments are allowed';
  end if;

  select * into v_match
  from public.matches m
  where m.id = p_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if not public.current_user_can_submit_score(p_match_id) then
    raise exception 'Forbidden: cannot submit arbiter request for this match';
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
    v_paths[1],
    'open',
    auth.uid()
  )
  returning id into v_request_id;

  v_i := 0;
  foreach v_path in array v_paths
  loop
    insert into public.arbiter_request_attachments (
      arbiter_request_id,
      storage_path,
      sort_order
    )
    values (v_request_id, v_path, v_i);
    v_i := v_i + 1;
  end loop;

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

  v_can_submit := public.current_user_can_submit_score(p_match_id);

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

grant execute on function public.arbiter_request_create(uuid, text[]) to authenticated;
grant select on table public.arbiter_request_attachments to authenticated;
