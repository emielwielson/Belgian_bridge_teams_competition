-- Rollback LIGA 3 B bye-fill: restore from ops_backup_liga3b_bye_fill_* tables.
-- Safe to run after regenerate (clears current fixtures first, then restores snapshot).
--
-- Restores the bye slot and original fixtures. The new team stays in the group but
-- is no longer in a schedule slot (as in the pre-fill snapshot).
--
-- Run in Supabase SQL editor as postgres.
-- After restore: revalidate standings for the group
--   (or re-run regenerate path / cron revalidate).
-- Does NOT drop backup tables — drop manually after sign-off.

do $$
declare
  v_group_id uuid;
  v_team_id uuid;
  v_team_name text;
  v_bye_slot int;
  v_match_count int;
  v_bye_count int;
  v_slot_count int;
begin
  if to_regclass('public.ops_backup_liga3b_bye_fill_meta') is null then
    raise exception 'Backup meta table missing; cannot rollback';
  end if;

  if to_regclass('public.ops_backup_liga3b_bye_fill_matches') is null
     or to_regclass('public.ops_backup_liga3b_bye_fill_byes') is null
     or to_regclass('public.ops_backup_liga3b_bye_fill_slots') is null
     or to_regclass('public.ops_backup_liga3b_bye_fill_rulings') is null then
    raise exception 'One or more ops_backup_liga3b_bye_fill_* tables are missing';
  end if;

  select
    group_id,
    team_id,
    team_name,
    bye_slot,
    match_count,
    bye_count,
    slot_count
  into
    v_group_id,
    v_team_id,
    v_team_name,
    v_bye_slot,
    v_match_count,
    v_bye_count,
    v_slot_count
  from public.ops_backup_liga3b_bye_fill_meta
  limit 1;

  if v_group_id is null then
    raise exception 'Backup meta is empty';
  end if;

  raise notice
    'Restoring snapshot: % matches, % byes, % slots (team %, bye slot %)',
    v_match_count, v_bye_count, v_slot_count, v_team_name, v_bye_slot;

  alter table public.matches disable trigger matches_block_delete_active;

  delete from public.rulings r
  using public.matches m
  where r.match_id = m.id
    and m.group_id = v_group_id;

  delete from public.group_bye_rounds
  where group_id = v_group_id;

  delete from public.matches
  where group_id = v_group_id;

  delete from public.group_schedule_slots
  where group_id = v_group_id;

  insert into public.group_schedule_slots
  select * from public.ops_backup_liga3b_bye_fill_slots;

  insert into public.matches
  select * from public.ops_backup_liga3b_bye_fill_matches;

  insert into public.group_bye_rounds
  select * from public.ops_backup_liga3b_bye_fill_byes;

  insert into public.rulings
  select * from public.ops_backup_liga3b_bye_fill_rulings;

  -- Related tables were required empty at fill time; restore if any rows were snapshotted.
  if to_regclass('public.ops_backup_liga3b_bye_fill_home_away') is not null then
    insert into public.match_home_away_switch_requests
    select * from public.ops_backup_liga3b_bye_fill_home_away;
  end if;

  if to_regclass('public.ops_backup_liga3b_bye_fill_postponements') is not null then
    insert into public.match_postponement_requests
    select * from public.ops_backup_liga3b_bye_fill_postponements;
  end if;

  if to_regclass('public.ops_backup_liga3b_bye_fill_lineups') is not null then
    insert into public.match_players
    select * from public.ops_backup_liga3b_bye_fill_lineups;
  end if;

  if to_regclass('public.ops_backup_liga3b_bye_fill_arbiter_requests') is not null then
    insert into public.arbiter_requests
    select * from public.ops_backup_liga3b_bye_fill_arbiter_requests;
  end if;

  alter table public.matches enable trigger matches_block_delete_active;

  perform public.sync_group_round_count(v_group_id);

  raise notice
    'Rollback complete. Bye restored on slot %. Team "%" (%) remains in group but off slots.',
    v_bye_slot, v_team_name, v_team_id;
  raise notice
    'Revalidate standings for group %.',
    v_group_id;
  raise notice
    'Backup tables kept. Drop ops_backup_liga3b_bye_fill_* only after sign-off.';
end;
$$;

-- Verify restore
select
  meta.team_name,
  g.name as group_code,
  meta.bye_slot,
  gss.is_bye as slot_is_bye,
  gss.team_id is null as bye_slot_empty,
  (select count(*) from public.teams where group_id = meta.group_id) as teams_in_group,
  (select count(*) from public.matches where group_id = meta.group_id) as match_count,
  (select count(*) from public.group_bye_rounds where group_id = meta.group_id) as bye_count
from public.ops_backup_liga3b_bye_fill_meta meta
join public.groups g on g.id = meta.group_id
left join public.group_schedule_slots gss
  on gss.group_id = meta.group_id
 and gss.slot = meta.bye_slot;
