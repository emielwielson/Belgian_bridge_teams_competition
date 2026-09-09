-- Smoke test: competition kinds + scoped competition managers (0061–0062)

do $$
declare
  v_national uuid;
  v_flanders uuid;
  v_wallonia uuid;
  v_league_kind uuid;
begin
  select id into v_national from public.competition_kinds where code = 'national';
  select id into v_flanders from public.competition_kinds where code = 'flanders';
  select id into v_wallonia from public.competition_kinds where code = 'wallonia';

  if v_national is null or v_flanders is null or v_wallonia is null then
    raise exception 'Missing competition_kinds seed rows';
  end if;

  if exists (
    select 1 from public.leagues where competition_kind_id is null
  ) then
    raise exception 'All leagues must have competition_kind_id';
  end if;

  -- National leagues map to national kind
  if exists (
    select 1
    from public.leagues l
    where l.scope = 'national'
      and l.competition_kind_id <> v_national
  ) then
    raise exception 'National leagues must use national competition kind';
  end if;

  -- Regional leagues map via region code
  if exists (
    select 1
    from public.leagues l
    join public.regions r on r.id = l.region_id
    join public.competition_kinds ck on ck.id = l.competition_kind_id
    where l.scope = 'regional'
      and ck.code <> r.code
  ) then
    raise exception 'Regional leagues must match region competition kind';
  end if;

  if to_regprocedure('public.current_user_manages_competition_kind(uuid)') is null then
    raise exception 'Missing helper: current_user_manages_competition_kind';
  end if;
  if to_regprocedure('public.current_user_manages_league(uuid)') is null then
    raise exception 'Missing helper: current_user_manages_league';
  end if;
  if to_regprocedure('public.current_user_manages_match(uuid)') is null then
    raise exception 'Missing helper: current_user_manages_match';
  end if;
  if to_regprocedure('public.current_user_manages_club(uuid)') is null then
    raise exception 'Missing helper: current_user_manages_club';
  end if;

  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'competition_manager_scopes'
  ) then
    raise exception 'Missing table: competition_manager_scopes';
  end if;

  raise notice 'scoped_competition_manager_smoke_test passed';
end;
$$;
