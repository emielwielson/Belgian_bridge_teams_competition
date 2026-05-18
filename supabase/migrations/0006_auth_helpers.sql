-- Task 2.3: Authorization helpers for RLS policies

create or replace function public.current_user_has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = p_role
  );
$$;

create or replace function public.current_user_has_any_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = any (p_roles)
  );
$$;

create or replace function public.current_user_is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_has_role('system_admin');
$$;

create or replace function public.current_user_is_competition_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_has_any_role(array['system_admin', 'competition_manager']);
$$;

grant execute on function public.current_user_has_role(text) to anon, authenticated;
grant execute on function public.current_user_has_any_role(text[]) to anon, authenticated;
grant execute on function public.current_user_is_system_admin() to anon, authenticated;
grant execute on function public.current_user_is_competition_manager() to anon, authenticated;
