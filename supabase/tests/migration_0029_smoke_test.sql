-- Migration 0029 smoke test (shared DB, Ledenbeheer user_admin)
-- Run in Supabase SQL Editor after migration 0029 is applied.
-- Competition migrations and 0026–0028 membership policies must remain intact.

do $$
declare
  v_test_user uuid;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'display_name'
  ) then
    raise exception 'Missing column: user_profiles.display_name';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'email'
  ) then
    raise exception 'Missing column: user_profiles.email';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'user_in_scope'
  ) then
    raise exception 'Missing function: user_in_scope';
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'user_profiles' and t.tgname = 'trg_user_profiles_before_write'
  ) then
    raise exception 'Missing trigger: trg_user_profiles_before_write';
  end if;

  -- Competition first-login profile: no email/federation columns required.
  select u.id into v_test_user
  from auth.users u
  left join public.user_profiles up on up.user_id = u.id
  where up.user_id is null
  limit 1;

  if v_test_user is null then
    raise exception 'No auth user without profile available for insert test';
  end if;

  insert into public.user_profiles (user_id, preferred_locale, updated_at)
  values (v_test_user, 'en', now());

  if not exists (
    select 1 from public.user_profiles
    where user_id = v_test_user and federation is null and email is null
  ) then
    raise exception 'Competition profile insert failed';
  end if;

  delete from public.user_profiles where user_id = v_test_user;
end $$;

select 'migration_0029_smoke_test passed' as result;
