-- Rollback Haacht 2 move: restore Liga 2E/G from ops_backup_haacht2_move_* tables.
-- Safe to run after regenerate (clears current fixtures first, then restores snapshot).
--
-- Run in Supabase SQL editor as postgres.
-- After restore: revalidate standings for both groups
--   (POST /api/admin/competition/groups/<id>/revalidate).
-- Does NOT drop backup tables — drop manually after sign-off.

do $$
declare
  v_team_id uuid;
  v_original_group_id uuid;
  v_group_e_id uuid;
  v_group_g_id uuid;
  v_match_count int;
  v_bye_count int;
  v_slot_count int;
  v_ruling_count int;
begin
  if to_regclass('public.ops_backup_haacht2_move_meta') is null then
    raise exception 'Backup meta table missing; cannot rollback';
  end if;

  if to_regclass('public.ops_backup_haacht2_move_matches') is null
     or to_regclass('public.ops_backup_haacht2_move_byes') is null
     or to_regclass('public.ops_backup_haacht2_move_slots') is null
     or to_regclass('public.ops_backup_haacht2_move_rulings') is null then
    raise exception 'One or more ops_backup_haacht2_move_* tables are missing';
  end if;

  select
    team_id,
    original_group_id,
    group_e_id,
    group_g_id,
    match_count,
    bye_count,
    slot_count,
    ruling_count
  into
    v_team_id,
    v_original_group_id,
    v_group_e_id,
    v_group_g_id,
    v_match_count,
    v_bye_count,
    v_slot_count,
    v_ruling_count
  from public.ops_backup_haacht2_move_meta
  limit 1;

  if v_team_id is null then
    raise exception 'Backup meta is empty';
  end if;

  raise notice
    'Restoring snapshot: % matches, % byes, % slots, % rulings',
    v_match_count, v_bye_count, v_slot_count, v_ruling_count;

  alter table public.matches disable trigger matches_block_delete_active;

  -- Clear current E/G fixtures (covers post-regenerate state)
  delete from public.rulings r
  using public.matches m
  where r.match_id = m.id
    and m.group_id in (v_group_e_id, v_group_g_id);

  delete from public.group_bye_rounds
  where group_id in (v_group_e_id, v_group_g_id);

  delete from public.matches
  where group_id in (v_group_e_id, v_group_g_id);

  -- Restore team membership before matches (matches_teams_in_group)
  update public.teams
  set group_id = v_original_group_id
  where id = v_team_id;

  -- Restore slots
  delete from public.group_schedule_slots
  where group_id in (v_group_e_id, v_group_g_id);

  insert into public.group_schedule_slots
  select * from public.ops_backup_haacht2_move_slots;

  -- Restore matches (preserve original ids)
  insert into public.matches
  select * from public.ops_backup_haacht2_move_matches;

  insert into public.group_bye_rounds
  select * from public.ops_backup_haacht2_move_byes;

  insert into public.rulings
  select * from public.ops_backup_haacht2_move_rulings;

  alter table public.matches enable trigger matches_block_delete_active;

  perform public.sync_group_round_count(v_group_e_id);
  perform public.sync_group_round_count(v_group_g_id);

  raise notice
    'Rollback complete. Haacht 2 (%) restored to group %.',
    v_team_id, v_original_group_id;
  raise notice
    'Revalidate standings for E (%) and G (%).',
    v_group_e_id, v_group_g_id;
  raise notice
    'Backup tables kept. Drop ops_backup_haacht2_move_* only after sign-off.';
end;
$$;

-- Verify restore
select
  meta.team_name,
  g.name as group_code,
  gss.slot as team_slot,
  (select count(*) from public.teams where group_id = meta.original_group_id) as teams_in_g,
  (select count(*) from public.teams where group_id = meta.group_e_id) as teams_in_e,
  (select count(*) from public.matches where group_id in (meta.group_e_id, meta.group_g_id)) as match_count,
  (select count(*) from public.group_bye_rounds where group_id in (meta.group_e_id, meta.group_g_id)) as bye_count
from public.ops_backup_haacht2_move_meta meta
join public.teams t on t.id = meta.team_id
join public.groups g on g.id = t.group_id
left join public.group_schedule_slots gss
  on gss.group_id = t.group_id and gss.team_id = t.id;
