-- Drop LIGA 3 B bye-fill backup tables after sign-off (rollback no longer needed).
-- Safe to re-run. Run in Supabase SQL editor as postgres.

drop table if exists public.ops_backup_liga3b_bye_fill_slots;
drop table if exists public.ops_backup_liga3b_bye_fill_matches;
drop table if exists public.ops_backup_liga3b_bye_fill_byes;
drop table if exists public.ops_backup_liga3b_bye_fill_rulings;
drop table if exists public.ops_backup_liga3b_bye_fill_home_away;
drop table if exists public.ops_backup_liga3b_bye_fill_postponements;
drop table if exists public.ops_backup_liga3b_bye_fill_lineups;
drop table if exists public.ops_backup_liga3b_bye_fill_arbiter_requests;
drop table if exists public.ops_backup_liga3b_bye_fill_meta;
