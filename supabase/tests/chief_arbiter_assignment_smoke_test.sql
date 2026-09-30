-- Smoke checks for chief arbiter + request assignment (0081).

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'arbiter_competition_scopes'
      and column_name = 'is_chief'
  ) then
    raise exception 'arbiter_competition_scopes.is_chief missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'arbiter_competition_scopes_one_chief_per_kind'
  ) then
    raise exception 'one-chief-per-kind unique index missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'arbiter_requests'
      and column_name = 'assigned_arbiter_id'
  ) then
    raise exception 'arbiter_requests.assigned_arbiter_id missing';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'arbiter_request_assign'
      and pg_get_function_identity_arguments(p.oid) = 'uuid, uuid'
  ) then
    raise exception 'arbiter_request_assign(uuid, uuid) missing';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'current_user_is_chief_arbiter_for_match'
  ) then
    raise exception 'current_user_is_chief_arbiter_for_match missing';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'current_user_can_resolve_arbiter_request'
  ) then
    raise exception 'current_user_can_resolve_arbiter_request missing';
  end if;
end;
$$;
