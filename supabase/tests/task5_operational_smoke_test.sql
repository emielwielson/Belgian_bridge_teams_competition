-- Task 5.3–5.8 operational smoke (run after 0024–0026)

do $$
declare
  v_missing text[];
begin
  select array_agg(expected.name)
  into v_missing
  from (
    values
      ('current_user_is_arbiter'),
      ('arbiter_request_create'),
      ('arbiter_request_resolve'),
      ('get_match_arbiter_requests_state'),
      ('propose_match_postponement'),
      ('propose_match_home_away_switch')
  ) as expected(name)
  left join pg_proc p on p.proname = expected.name
    and p.pronamespace = 'public'::regnamespace
  where p.oid is null;

  if v_missing is not null then
    raise exception 'Missing functions: %', array_to_string(v_missing, ', ');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'arbiter_requests'
  ) then
    raise exception 'arbiter_requests table missing';
  end if;

  if not exists (
    select 1 from storage.buckets where id = 'operational-files'
  ) then
    raise exception 'operational-files storage bucket missing';
  end if;
end;
$$;

select 'task5_operational_smoke_test passed' as status;
