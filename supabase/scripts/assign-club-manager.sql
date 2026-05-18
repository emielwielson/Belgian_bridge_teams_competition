-- Assign a user as club manager for one club.
-- Run in Supabase SQL Editor as competition_manager or system_admin.
--
-- Replace:
--   <user_id>  — auth.users.id (Authentication → Users)
--   <club_id>  — clubs.id (Table Editor → clubs)

-- 1. Role (middleware / dashboard)
insert into public.user_roles (user_id, role)
values ('<user_id>', 'club_manager')
on conflict (user_id, role) do nothing;

-- 2. Club assignment (which club they manage)
insert into public.club_manager_assignments (user_id, club_id)
values ('<user_id>', '<club_id>')
on conflict (user_id, club_id) do nothing;
