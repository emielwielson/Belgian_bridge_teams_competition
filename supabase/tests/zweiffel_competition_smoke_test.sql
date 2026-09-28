-- Smoke test: Zweiffel region/kind, captain + club-region exceptions (0076)

do $$
declare
  v_zweiffel_region uuid;
  v_zweiffel_kind uuid;
  v_fn text;
begin
  select id into v_zweiffel_region from public.regions where code = 'zweiffel';
  select id into v_zweiffel_kind from public.competition_kinds where code = 'zweiffel';

  if v_zweiffel_region is null then
    raise exception 'Missing regions.zweiffel';
  end if;
  if v_zweiffel_kind is null then
    raise exception 'Missing competition_kinds.zweiffel';
  end if;

  -- Captain trigger must allow second/federation without requiring active status
  select pg_get_functiondef(oid) into v_fn
  from pg_proc
  where proname = 'enforce_team_captain_club_membership'
    and pronamespace = 'public'::regnamespace
  limit 1;

  if v_fn is null or position('''second''' in v_fn) = 0 then
    raise exception 'Captain trigger must allow second membership for Zweiffel';
  end if;
  if position('''federation''' in v_fn) = 0 then
    raise exception 'Captain trigger must allow federation membership for Zweiffel';
  end if;
  if position('pcm_primary' in v_fn) = 0 then
    raise exception 'Captain trigger must require active primary for second/federation';
  end if;

  select pg_get_functiondef(oid) into v_fn
  from pg_proc
  where proname = 'enforce_regional_team_club_region'
    and pronamespace = 'public'::regnamespace
  limit 1;

  if v_fn is null or position('zweiffel' in v_fn) = 0 then
    raise exception 'Regional club-region trigger must waive match for Zweiffel';
  end if;

  raise notice 'zweiffel_competition_smoke_test passed';
end;
$$;
