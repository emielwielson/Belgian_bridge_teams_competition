-- Task 50 smoke: shared email + multi-player profile auth

-- Duplicate player emails allowed
do $$
begin
  insert into public.players (name, email) values ('Smoke A', 'shared-smoke@example.com');
  insert into public.players (name, email) values ('Smoke B', 'shared-smoke@example.com');
exception
  when unique_violation then
    raise exception 'Duplicate player emails should be allowed';
end;
$$;

delete from public.players where email = 'shared-smoke@example.com';

-- player_auth_links table exists
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'player_auth_links'
  ) then
    raise exception 'player_auth_links table missing';
  end if;
end;
$$;

-- user_profiles.active_player_id column exists
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'active_player_id'
  ) then
    raise exception 'user_profiles.active_player_id column missing';
  end if;
end;
$$;

-- players.auth_user_id column removed
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'players'
      and column_name = 'auth_user_id'
  ) then
    raise exception 'players.auth_user_id should be removed';
  end if;
end;
$$;

-- Helper functions exist
do $$
declare
  v_missing text[];
begin
  select array_agg(expected.name)
  into v_missing
  from (
    values
      ('sync_player_auth_links'),
      ('set_active_player'),
      ('current_user_player_id')
  ) as expected(name)
  left join pg_proc p on p.proname = expected.name
    and p.pronamespace = 'public'::regnamespace
  where p.oid is null;

  if v_missing is not null then
    raise exception 'Missing functions: %', array_to_string(v_missing, ', ');
  end if;
end;
$$;

select 'task50_player_auth_smoke_test passed' as status;
