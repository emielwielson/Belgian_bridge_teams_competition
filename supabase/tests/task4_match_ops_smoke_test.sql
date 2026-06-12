-- Task 4.11 smoke: match ops helpers exist (run after 0013_match_ops.sql)

do $$
declare
  v_missing text[];
begin
  select array_agg(p.proname::text)
  into v_missing
  from (
    values
      ('current_user_player_id'),
      ('current_user_on_match_team'),
      ('current_user_can_submit_score'),
      ('current_user_can_edit_lineup'),
      ('lookup_vp_for_match')
  ) as expected(name)
  left join pg_proc p on p.proname = expected.name
    and p.pronamespace = 'public'::regnamespace
  where p.oid is null;

  if v_missing is not null then
    raise exception 'Missing functions: %', array_to_string(v_missing, ', ');
  end if;
end;
$$;

-- players.auth_user_id column
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'players'
      and column_name = 'auth_user_id'
  ) then
    raise exception 'players.auth_user_id column missing';
  end if;
end;
$$;

select 'task4_match_ops_smoke_test passed' as status;
