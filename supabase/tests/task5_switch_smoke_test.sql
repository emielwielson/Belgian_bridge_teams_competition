-- Task 5.2 smoke: home/away switch helpers exist (run after 0022_match_home_away_switch.sql)

do $$
declare
  v_missing text[];
begin
  select array_agg(expected.name)
  into v_missing
  from (
    values
      ('match_mirror_switch_context'),
      ('match_has_pending_home_away_switch'),
      ('match_has_pending_postponement'),
      ('current_user_can_view_match_home_away_switch'),
      ('propose_match_home_away_switch'),
      ('respond_match_home_away_switch'),
      ('get_match_home_away_switch_state')
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
      and table_name = 'match_home_away_switch_requests'
  ) then
    raise exception 'match_home_away_switch_requests table missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'hosting_team_id'
  ) then
    raise exception 'matches.hosting_team_id column missing';
  end if;
end;
$$;

-- mirror_switch_context on non-existent match returns null
do $$
declare
  v_ctx jsonb;
begin
  v_ctx := public.match_mirror_switch_context('00000000-0000-0000-0000-000000000000'::uuid);
  if v_ctx is not null then
    raise exception 'expected null context for missing match';
  end if;
end;
$$;

select 'task5_switch_smoke_test passed' as status;
