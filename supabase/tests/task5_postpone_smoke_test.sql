-- Task 5.1 smoke: postponement helpers exist (run after 0021_match_postponements.sql)

do $$
declare
  v_missing text[];
begin
  select array_agg(expected.name)
  into v_missing
  from (
    values
      ('current_user_is_captain_of_team'),
      ('current_user_can_view_match_postponement'),
      ('propose_match_postponement'),
      ('respond_match_postponement'),
      ('get_match_postponement_state')
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
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_postponement_requests'
  ) then
    raise exception 'match_postponement_requests table missing';
  end if;
end;
$$;

select 'task5_postpone_smoke_test passed' as status;
