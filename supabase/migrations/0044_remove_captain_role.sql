-- Captain permissions are team-scoped (teams.captain_id), not user_roles.

delete from public.user_roles where role = 'captain';

alter table public.user_roles drop constraint user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (
  role in (
    'player',
    'club_manager',
    'arbiter',
    'competition_manager',
    'system_admin'
  )
);
