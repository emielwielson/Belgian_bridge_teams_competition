-- Smoke: team convention cards schema and auth helpers

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'team_convention_cards'
  ) then
    raise exception 'Missing table: team_convention_cards';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'current_user_can_manage_team_convention_cards'
  ) then
    raise exception 'Missing function: current_user_can_manage_team_convention_cards';
  end if;

  if not exists (
    select 1 from storage.buckets where id = 'convention-cards'
  ) then
    raise exception 'Missing storage bucket: convention-cards';
  end if;
end $$;
