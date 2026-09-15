-- Fill Flanders LIGA 3 B bye slot with a new team, then regenerate fixtures.
-- Snapshots state into ops_backup_liga3b_bye_fill_* for rollback.
--
-- Prerequisites:
--   1. Create the new team in Admin (Flanders → Teams → LIGA 3 B) so it exists
--      in the group but is NOT yet in a schedule slot.
--   2. Set v_new_team_name below to that team's exact name.
--
-- Live naming: division "LIGA 3", group "LIGA 3 B", region flanders.
-- Run in Supabase SQL editor as postgres.
-- After this script: regenerate fixtures with
--   cd web && npx tsx scripts/regenerate-liga3b-schedule.ts
--
-- Safety: aborts if any match has been scored/played, or if home/away hosting,
-- postponements, switch requests, lineups, arbiter requests, or rulings exist.

do $$
declare
  -- >>> EDIT: exact team name as created in Admin <<<
  v_new_team_name text := 'Riviera 17';

  v_season_id uuid;
  v_group_id uuid;
  v_team_id uuid;
  v_bye_slot int;
  v_team_count int;
  v_assigned_count int;
  v_bye_slot_count int;
  v_scored int;
  v_hosting_switched int;
  v_datetime_changed int;
  v_home_away_reqs int;
  v_postponement_reqs int;
  v_lineups int;
  v_arbiter_reqs int;
  v_ruling_count int;
  v_match_count int;
  v_bye_count int;
  v_slot_count int;
  v_switch_backup_count int;
  v_postponement_backup_count int;
  v_lineup_backup_count int;
  v_arbiter_backup_count int;
begin
  if v_new_team_name is null
     or btrim(v_new_team_name) = ''
     or v_new_team_name = 'REPLACE_WITH_TEAM_NAME' then
    raise exception
      'Set v_new_team_name to the new team name before running this script';
  end if;

  if to_regclass('public.ops_backup_liga3b_bye_fill_meta') is not null then
    raise exception
      'Backup tables already exist (ops_backup_liga3b_bye_fill_*). Drop them after sign-off, or run rollback first.';
  end if;

  select s.id into v_season_id
  from public.seasons s
  where s.is_active = true
  limit 1;

  if v_season_id is null then
    raise exception 'No active season found';
  end if;

  select g.id into v_group_id
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  join public.regions r on r.id = l.region_id
  where l.season_id = v_season_id
    and l.scope = 'regional'
    and r.code = 'flanders'
    and d.name = 'LIGA 3'
    and g.name = 'LIGA 3 B';

  if v_group_id is null then
    raise exception 'Flanders LIGA 3 B group not found';
  end if;

  select t.id into v_team_id
  from public.teams t
  where t.group_id = v_group_id
    and t.name = v_new_team_name;

  if v_team_id is null then
    raise exception
      'Team "%" not found in LIGA 3 B — create it in Admin first',
      v_new_team_name;
  end if;

  if exists (
    select 1
    from public.group_schedule_slots gss
    where gss.group_id = v_group_id
      and gss.team_id = v_team_id
  ) then
    raise exception
      'Team "%" is already assigned to a schedule slot',
      v_new_team_name;
  end if;

  select count(*) into v_team_count
  from public.teams t
  where t.group_id = v_group_id;

  if v_team_count <> 8 then
    raise exception
      'Expected 8 teams in LIGA 3 B (7 + new), found %',
      v_team_count;
  end if;

  select count(*) into v_bye_slot_count
  from public.group_schedule_slots gss
  where gss.group_id = v_group_id
    and gss.is_bye;

  if v_bye_slot_count <> 1 then
    raise exception
      'Expected exactly one bye slot in LIGA 3 B, found %',
      v_bye_slot_count;
  end if;

  select gss.slot into v_bye_slot
  from public.group_schedule_slots gss
  where gss.group_id = v_group_id
    and gss.is_bye
  limit 1;

  if exists (
    select 1
    from public.group_schedule_slots gss
    where gss.group_id = v_group_id
      and gss.slot = v_bye_slot
      and gss.team_id is not null
  ) then
    raise exception 'Bye slot % still has a team_id set', v_bye_slot;
  end if;

  select count(*) into v_assigned_count
  from public.group_schedule_slots gss
  where gss.group_id = v_group_id
    and gss.team_id is not null
    and not gss.is_bye;

  if v_assigned_count <> 7 then
    raise exception
      'Expected 7 assigned team slots before fill, found %',
      v_assigned_count;
  end if;

  -- --- Safety: refuse if matches were mutated beyond pristine fixtures ---

  select count(*) into v_scored
  from public.matches m
  where m.group_id = v_group_id
    and (
      m.imps_home is not null
      or m.imps_away is not null
      or m.vp_home is not null
      or m.vp_away is not null
      or m.played_at is not null
    );

  if v_scored > 0 then
    raise exception
      'Found % scored/played matches in LIGA 3 B; aborting',
      v_scored;
  end if;

  select count(*) into v_hosting_switched
  from public.matches m
  where m.group_id = v_group_id
    and m.hosting_team_id is distinct from m.home_team_id;

  if v_hosting_switched > 0 then
    raise exception
      'Found % matches with hosting_team_id <> home_team_id (home/away or venue switch applied); aborting',
      v_hosting_switched;
  end if;

  select count(*) into v_datetime_changed
  from public.matches m
  join public.groups g on g.id = m.group_id
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  join public.competition_match_dates cmd
    on cmd.season_id = l.season_id
   and cmd.scope = l.scope
   and cmd.region_id is not distinct from l.region_id
   and cmd.division_id is not distinct from
         public.resolve_group_match_dates_division_id(m.group_id)
   and cmd.round = m.round
  where m.group_id = v_group_id
    and m.datetime is distinct from cmd.datetime;

  if v_datetime_changed > 0 then
    raise exception
      'Found % matches whose datetime differs from competition_match_dates (likely postponement); aborting',
      v_datetime_changed;
  end if;

  select count(*) into v_home_away_reqs
  from public.match_home_away_switch_requests r
  join public.matches m on m.id = r.match_id
  where m.group_id = v_group_id;

  if v_home_away_reqs > 0 then
    raise exception
      'Found % home/away switch request(s) for LIGA 3 B; aborting',
      v_home_away_reqs;
  end if;

  select count(*) into v_postponement_reqs
  from public.match_postponement_requests r
  join public.matches m on m.id = r.match_id
  where m.group_id = v_group_id;

  if v_postponement_reqs > 0 then
    raise exception
      'Found % postponement request(s) for LIGA 3 B; aborting',
      v_postponement_reqs;
  end if;

  select count(*) into v_lineups
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  where m.group_id = v_group_id;

  if v_lineups > 0 then
    raise exception
      'Found % match_players row(s) (lineups) for LIGA 3 B; aborting',
      v_lineups;
  end if;

  select count(*) into v_arbiter_reqs
  from public.arbiter_requests ar
  join public.matches m on m.id = ar.match_id
  where m.group_id = v_group_id;

  if v_arbiter_reqs > 0 then
    raise exception
      'Found % arbiter request(s) for LIGA 3 B; aborting',
      v_arbiter_reqs;
  end if;

  select count(*) into v_ruling_count
  from public.rulings r
  join public.matches m on m.id = r.match_id
  where m.group_id = v_group_id;

  if v_ruling_count > 0 then
    raise exception
      'Found % ruling(s) for LIGA 3 B; aborting',
      v_ruling_count;
  end if;

  -- Snapshot (including empty related tables for audit)
  create table public.ops_backup_liga3b_bye_fill_slots as
  select *
  from public.group_schedule_slots
  where group_id = v_group_id;

  create table public.ops_backup_liga3b_bye_fill_matches as
  select *
  from public.matches
  where group_id = v_group_id;

  create table public.ops_backup_liga3b_bye_fill_byes as
  select *
  from public.group_bye_rounds
  where group_id = v_group_id;

  create table public.ops_backup_liga3b_bye_fill_rulings as
  select r.*
  from public.rulings r
  join public.matches m on m.id = r.match_id
  where m.group_id = v_group_id;

  create table public.ops_backup_liga3b_bye_fill_home_away as
  select r.*
  from public.match_home_away_switch_requests r
  join public.matches m on m.id = r.match_id
  where m.group_id = v_group_id;

  create table public.ops_backup_liga3b_bye_fill_postponements as
  select r.*
  from public.match_postponement_requests r
  join public.matches m on m.id = r.match_id
  where m.group_id = v_group_id;

  create table public.ops_backup_liga3b_bye_fill_lineups as
  select mp.*
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  where m.group_id = v_group_id;

  create table public.ops_backup_liga3b_bye_fill_arbiter_requests as
  select ar.*
  from public.arbiter_requests ar
  join public.matches m on m.id = ar.match_id
  where m.group_id = v_group_id;

  select count(*) into v_match_count from public.ops_backup_liga3b_bye_fill_matches;
  select count(*) into v_bye_count from public.ops_backup_liga3b_bye_fill_byes;
  select count(*) into v_slot_count from public.ops_backup_liga3b_bye_fill_slots;
  select count(*) into v_ruling_count from public.ops_backup_liga3b_bye_fill_rulings;
  select count(*) into v_switch_backup_count from public.ops_backup_liga3b_bye_fill_home_away;
  select count(*) into v_postponement_backup_count from public.ops_backup_liga3b_bye_fill_postponements;
  select count(*) into v_lineup_backup_count from public.ops_backup_liga3b_bye_fill_lineups;
  select count(*) into v_arbiter_backup_count from public.ops_backup_liga3b_bye_fill_arbiter_requests;

  create table public.ops_backup_liga3b_bye_fill_meta (
    created_at timestamptz not null default now(),
    season_id uuid not null,
    group_id uuid not null,
    team_id uuid not null,
    team_name text not null,
    bye_slot int not null,
    match_count int not null,
    bye_count int not null,
    slot_count int not null,
    ruling_count int not null,
    home_away_count int not null,
    postponement_count int not null,
    lineup_count int not null,
    arbiter_request_count int not null
  );

  alter table public.ops_backup_liga3b_bye_fill_slots enable row level security;
  alter table public.ops_backup_liga3b_bye_fill_matches enable row level security;
  alter table public.ops_backup_liga3b_bye_fill_byes enable row level security;
  alter table public.ops_backup_liga3b_bye_fill_rulings enable row level security;
  alter table public.ops_backup_liga3b_bye_fill_home_away enable row level security;
  alter table public.ops_backup_liga3b_bye_fill_postponements enable row level security;
  alter table public.ops_backup_liga3b_bye_fill_lineups enable row level security;
  alter table public.ops_backup_liga3b_bye_fill_arbiter_requests enable row level security;
  alter table public.ops_backup_liga3b_bye_fill_meta enable row level security;

  revoke all on table public.ops_backup_liga3b_bye_fill_slots from anon, authenticated;
  revoke all on table public.ops_backup_liga3b_bye_fill_matches from anon, authenticated;
  revoke all on table public.ops_backup_liga3b_bye_fill_byes from anon, authenticated;
  revoke all on table public.ops_backup_liga3b_bye_fill_rulings from anon, authenticated;
  revoke all on table public.ops_backup_liga3b_bye_fill_home_away from anon, authenticated;
  revoke all on table public.ops_backup_liga3b_bye_fill_postponements from anon, authenticated;
  revoke all on table public.ops_backup_liga3b_bye_fill_lineups from anon, authenticated;
  revoke all on table public.ops_backup_liga3b_bye_fill_arbiter_requests from anon, authenticated;
  revoke all on table public.ops_backup_liga3b_bye_fill_meta from anon, authenticated;

  insert into public.ops_backup_liga3b_bye_fill_meta (
    season_id,
    group_id,
    team_id,
    team_name,
    bye_slot,
    match_count,
    bye_count,
    slot_count,
    ruling_count,
    home_away_count,
    postponement_count,
    lineup_count,
    arbiter_request_count
  ) values (
    v_season_id,
    v_group_id,
    v_team_id,
    v_new_team_name,
    v_bye_slot,
    v_match_count,
    v_bye_count,
    v_slot_count,
    v_ruling_count,
    v_switch_backup_count,
    v_postponement_backup_count,
    v_lineup_backup_count,
    v_arbiter_backup_count
  );

  raise notice
    'Snapshot: % matches, % byes, % slots, bye_slot=%, team=%',
    v_match_count, v_bye_count, v_slot_count, v_bye_slot, v_new_team_name;

  -- Clear fixtures (league may be active)
  alter table public.matches disable trigger matches_block_delete_active;

  delete from public.rulings r
  using public.matches m
  where r.match_id = m.id
    and m.group_id = v_group_id;

  delete from public.group_bye_rounds
  where group_id = v_group_id;

  delete from public.matches
  where group_id = v_group_id;

  alter table public.matches enable trigger matches_block_delete_active;

  update public.group_schedule_slots
  set team_id = v_team_id, is_bye = false
  where group_id = v_group_id
    and slot = v_bye_slot;

  perform public.sync_group_round_count(v_group_id);

  raise notice
    'Placed "%" (%) into LIGA 3 B slot % (was bye).',
    v_new_team_name, v_team_id, v_bye_slot;
  raise notice
    'Next: cd web && npx tsx scripts/regenerate-liga3b-schedule.ts';
  raise notice
    'Rollback: run supabase/scripts/rollback-liga3b-bye-fill.sql (keeps backup tables).';
end;
$$;

-- Post-condition check
select
  meta.team_name,
  g.name as group_code,
  meta.bye_slot as filled_slot,
  gss.is_bye as slot_is_bye,
  gss.team_id = meta.team_id as slot_has_new_team,
  (select count(*) from public.teams where group_id = meta.group_id) as teams_in_group,
  (
    select count(*) from public.matches m where m.group_id = meta.group_id
  ) as match_count,
  (
    select count(*) from public.group_bye_rounds b where b.group_id = meta.group_id
  ) as bye_rounds
from public.ops_backup_liga3b_bye_fill_meta meta
join public.groups g on g.id = meta.group_id
left join public.group_schedule_slots gss
  on gss.group_id = meta.group_id
 and gss.slot = meta.bye_slot;
