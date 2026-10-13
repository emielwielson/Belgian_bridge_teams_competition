-- Location change helpers exist (run after 0084_match_location_change.sql)

do $$
declare
  v_missing text[];
begin
  select array_agg(expected.name)
  into v_missing
  from (
    values
      ('match_has_pending_location_change'),
      ('match_has_pending_postponement'),
      ('current_user_can_view_match_location_change'),
      ('propose_match_location_change'),
      ('respond_match_location_change'),
      ('get_match_location_change_state'),
      ('resolve_team_match_location')
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
      and table_name = 'match_location_change_requests'
  ) then
    raise exception 'match_location_change_requests table missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'location_override'
  ) then
    raise exception 'matches.location_override column missing';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'match_home_away_switch_requests'
  ) then
    raise exception 'match_home_away_switch_requests should have been dropped';
  end if;
end;
$$;

select 'task5_location_change_smoke_test passed' as status;
