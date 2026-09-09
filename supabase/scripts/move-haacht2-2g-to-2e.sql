-- Move Haacht 2 from Flanders LIGA 2 G (slot 3) to LIGA 2 E (slot 8),
-- swapping with the bye. Snapshots state into ops_backup_haacht2_move_* tables
-- for rollback via rollback-haacht2-2g-to-2e.sql.
--
-- Live naming: division "LIGA 2", groups "LIGA 2 E" / "LIGA 2 G".
-- Run in Supabase SQL editor as postgres.
-- After this script: regenerate fixtures with
--   cd web && npx tsx scripts/regenerate-liga2-eg-schedules.ts

do $$
declare
  v_season_id uuid;
  v_group_e_id uuid;
  v_group_g_id uuid;
  v_team_id uuid;
  v_slot_g3_team uuid;
  v_slot_e8_is_bye boolean;
  v_slot_e8_team uuid;
  v_count_e int;
  v_count_g int;
  v_scored int;
  v_match_count int;
  v_bye_count int;
  v_slot_count int;
  v_ruling_count int;
begin
  if to_regclass('public.ops_backup_haacht2_move_meta') is not null then
    raise exception
      'Backup tables already exist (ops_backup_haacht2_move_*). Drop them after sign-off, or run rollback first.';
  end if;

  select s.id into v_season_id
  from public.seasons s
  where s.is_active = true
  limit 1;

  if v_season_id is null then
    raise exception 'No active season found';
  end if;

  -- Live Flanders naming: division "LIGA 2", groups "LIGA 2 E" / "LIGA 2 G".
  select g.id into v_group_e_id
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  join public.regions r on r.id = l.region_id
  where l.season_id = v_season_id
    and l.scope = 'regional'
    and r.code = 'flanders'
    and d.name = 'LIGA 2'
    and g.name = 'LIGA 2 E';

  select g.id into v_group_g_id
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  join public.regions r on r.id = l.region_id
  where l.season_id = v_season_id
    and l.scope = 'regional'
    and r.code = 'flanders'
    and d.name = 'LIGA 2'
    and g.name = 'LIGA 2 G';

  if v_group_e_id is null or v_group_g_id is null then
    raise exception 'Flanders LIGA 2 groups E and/or G not found';
  end if;

  select t.id into v_team_id
  from public.teams t
  where t.group_id = v_group_g_id
    and t.name = 'Haacht 2';

  if v_team_id is null then
    raise exception 'Haacht 2 not found in LIGA 2 G';
  end if;

  select gss.team_id into v_slot_g3_team
  from public.group_schedule_slots gss
  where gss.group_id = v_group_g_id
    and gss.slot = 3;

  if v_slot_g3_team is distinct from v_team_id then
    raise exception
      'LIGA 2 G slot 3 is not Haacht 2 (found team_id %)', v_slot_g3_team;
  end if;

  select gss.is_bye, gss.team_id
  into v_slot_e8_is_bye, v_slot_e8_team
  from public.group_schedule_slots gss
  where gss.group_id = v_group_e_id
    and gss.slot = 8;

  if coalesce(v_slot_e8_is_bye, false) is not true or v_slot_e8_team is not null then
    raise exception
      'LIGA 2 E slot 8 is not a bye (is_bye=%, team_id=%)',
      v_slot_e8_is_bye, v_slot_e8_team;
  end if;

  select count(*) into v_count_e
  from public.teams t
  where t.group_id = v_group_e_id;

  select count(*) into v_count_g
  from public.teams t
  where t.group_id = v_group_g_id;

  if v_count_e <> 7 or v_count_g <> 8 then
    raise exception
      'Unexpected team counts (E=%, G=%); expected E=7 G=8',
      v_count_e, v_count_g;
  end if;

  select count(*) into v_scored
  from public.matches m
  where m.group_id in (v_group_e_id, v_group_g_id)
    and (
      m.imps_home is not null
      or m.imps_away is not null
      or m.vp_home is not null
      or m.vp_away is not null
      or m.played_at is not null
    );

  if v_scored > 0 then
    raise exception
      'Found % scored/played matches in LIGA 2 E/G; aborting', v_scored;
  end if;

  -- Snapshot
  create table public.ops_backup_haacht2_move_slots as
  select *
  from public.group_schedule_slots
  where group_id in (v_group_e_id, v_group_g_id);

  create table public.ops_backup_haacht2_move_matches as
  select *
  from public.matches
  where group_id in (v_group_e_id, v_group_g_id);

  create table public.ops_backup_haacht2_move_byes as
  select *
  from public.group_bye_rounds
  where group_id in (v_group_e_id, v_group_g_id);

  create table public.ops_backup_haacht2_move_rulings as
  select r.*
  from public.rulings r
  join public.matches m on m.id = r.match_id
  where m.group_id in (v_group_e_id, v_group_g_id);

  select count(*) into v_match_count from public.ops_backup_haacht2_move_matches;
  select count(*) into v_bye_count from public.ops_backup_haacht2_move_byes;
  select count(*) into v_slot_count from public.ops_backup_haacht2_move_slots;
  select count(*) into v_ruling_count from public.ops_backup_haacht2_move_rulings;

  create table public.ops_backup_haacht2_move_meta (
    created_at timestamptz not null default now(),
    season_id uuid not null,
    team_id uuid not null,
    team_name text not null,
    original_group_id uuid not null,
    group_e_id uuid not null,
    group_g_id uuid not null,
    match_count int not null,
    bye_count int not null,
    slot_count int not null,
    ruling_count int not null
  );

  -- Keep backups out of PostgREST: RLS on, no policies, revoke API roles.
  alter table public.ops_backup_haacht2_move_slots enable row level security;
  alter table public.ops_backup_haacht2_move_matches enable row level security;
  alter table public.ops_backup_haacht2_move_byes enable row level security;
  alter table public.ops_backup_haacht2_move_rulings enable row level security;
  alter table public.ops_backup_haacht2_move_meta enable row level security;
  revoke all on table public.ops_backup_haacht2_move_slots from anon, authenticated;
  revoke all on table public.ops_backup_haacht2_move_matches from anon, authenticated;
  revoke all on table public.ops_backup_haacht2_move_byes from anon, authenticated;
  revoke all on table public.ops_backup_haacht2_move_rulings from anon, authenticated;
  revoke all on table public.ops_backup_haacht2_move_meta from anon, authenticated;

  insert into public.ops_backup_haacht2_move_meta (
    season_id,
    team_id,
    team_name,
    original_group_id,
    group_e_id,
    group_g_id,
    match_count,
    bye_count,
    slot_count,
    ruling_count
  ) values (
    v_season_id,
    v_team_id,
    'Haacht 2',
    v_group_g_id,
    v_group_e_id,
    v_group_g_id,
    v_match_count,
    v_bye_count,
    v_slot_count,
    v_ruling_count
  );

  raise notice
    'Snapshot: % matches, % byes, % slots, % rulings',
    v_match_count, v_bye_count, v_slot_count, v_ruling_count;

  -- Clear fixtures (league is active)
  alter table public.matches disable trigger matches_block_delete_active;

  delete from public.rulings r
  using public.matches m
  where r.match_id = m.id
    and m.group_id in (v_group_e_id, v_group_g_id);

  delete from public.group_bye_rounds
  where group_id in (v_group_e_id, v_group_g_id);

  delete from public.matches
  where group_id in (v_group_e_id, v_group_g_id);

  alter table public.matches enable trigger matches_block_delete_active;

  -- Move team and swap slots
  update public.teams
  set group_id = v_group_e_id
  where id = v_team_id;

  update public.group_schedule_slots
  set team_id = null, is_bye = true
  where group_id = v_group_g_id
    and slot = 3;

  update public.group_schedule_slots
  set team_id = v_team_id, is_bye = false
  where group_id = v_group_e_id
    and slot = 8;

  perform public.sync_group_round_count(v_group_e_id);
  perform public.sync_group_round_count(v_group_g_id);

  raise notice
    'Moved Haacht 2 (%) from G (%) to E (%). Slot 3G=bye, slot 8E=team.',
    v_team_id, v_group_g_id, v_group_e_id;
  raise notice
    'Next: cd web && npx tsx scripts/regenerate-liga2-eg-schedules.ts';
  raise notice
    'Rollback: run supabase/scripts/rollback-haacht2-2g-to-2e.sql (keeps backup tables).';
end;
$$;

-- Post-condition check
select
  t.name as team,
  g.name as group_code,
  gss.slot as team_slot,
  gss.is_bye as team_slot_is_bye,
  (select count(*) from public.teams where group_id = t.group_id) as teams_in_group,
  (
    select count(*) from public.matches m where m.group_id = t.group_id
  ) as match_count
from public.teams t
join public.groups g on g.id = t.group_id
left join public.group_schedule_slots gss
  on gss.group_id = t.group_id and gss.team_id = t.id
where t.id = (select team_id from public.ops_backup_haacht2_move_meta limit 1);

select
  g.name as group_code,
  gss.slot,
  gss.is_bye,
  t.name as team_name
from public.ops_backup_haacht2_move_meta meta
join public.groups g on g.id in (meta.group_e_id, meta.group_g_id)
join public.group_schedule_slots gss on gss.group_id = g.id
left join public.teams t on t.id = gss.team_id
where gss.slot in (3, 8)
order by g.name, gss.slot;