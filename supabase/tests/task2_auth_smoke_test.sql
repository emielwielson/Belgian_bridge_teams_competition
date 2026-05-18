-- Task 2.8: Auth and RLS smoke tests (run after 0005–0007)

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_roles'
  ) then
    raise exception 'Missing table: user_roles';
  end if;
end $$;

do $$
declare
  v_table text;
  v_rls boolean;
  v_tables text[] := array[
    'regions', 'seasons', 'leagues', 'divisions', 'groups',
    'teams', 'matches', 'user_roles'
  ];
begin
  foreach v_table in array v_tables loop
    select c.relrowsecurity into v_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v_table;

    if not coalesce(v_rls, false) then
      raise exception 'RLS not enabled on %', v_table;
    end if;
  end loop;
end $$;

-- Helper functions exist
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'current_user_has_role'
  ) then
    raise exception 'Missing function: current_user_has_role';
  end if;
end $$;

select 'task2_auth_smoke_test passed' as result;

-- Manual checks after first signup:
-- insert into public.user_roles (user_id, role)
-- values ('<your-auth-users-id>', 'system_admin');
