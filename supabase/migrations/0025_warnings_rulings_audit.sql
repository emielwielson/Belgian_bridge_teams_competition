-- Task 5.4: Warnings/rulings audit columns and arbiter read on rulings

alter table public.warnings
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_at timestamptz;

alter table public.rulings
  add column if not exists ruling_date date default current_date,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_at timestamptz;

update public.rulings
set ruling_date = coalesce(ruling_date, (created_at at time zone 'Europe/Brussels')::date)
where ruling_date is null;

create or replace function public.current_user_is_arbiter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_has_role('arbiter');
$$;

grant execute on function public.current_user_is_arbiter() to anon, authenticated;

create policy rulings_arbiter_read on public.rulings
  for select to authenticated
  using (public.current_user_is_arbiter());
