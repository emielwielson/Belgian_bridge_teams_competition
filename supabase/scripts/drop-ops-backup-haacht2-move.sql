-- Drop Haacht 2 move backup tables after sign-off (rollback no longer needed).
-- Safe to re-run. Run in Supabase SQL editor as postgres.

drop table if exists public.ops_backup_haacht2_move_slots;
drop table if exists public.ops_backup_haacht2_move_matches;
drop table if exists public.ops_backup_haacht2_move_byes;
drop table if exists public.ops_backup_haacht2_move_rulings;
drop table if exists public.ops_backup_haacht2_move_meta;
