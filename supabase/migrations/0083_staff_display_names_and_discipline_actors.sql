-- Staff display names + snapshot actor names on penalties/warnings

alter table public.user_profiles
  add column if not exists display_name text;

alter table public.penalties
  add column if not exists created_by_name text,
  add column if not exists updated_by_name text;

alter table public.warnings
  add column if not exists created_by_name text,
  add column if not exists updated_by_name text;

create or replace function public.actor_display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select nullif(trim(up.display_name), '')
      from public.user_profiles up
      where up.user_id = p_user_id
    ),
    (
      select nullif(trim(p.name), '')
      from public.player_auth_links pal
      join public.players p on p.id = pal.player_id
      where pal.auth_user_id = p_user_id
      order by pal.created_at
      limit 1
    ),
    (
      select nullif(trim(u.email), '')
      from auth.users u
      where u.id = p_user_id
    )
  );
$$;

grant execute on function public.actor_display_name(uuid) to authenticated;

create or replace function public.discipline_set_actor_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is not null then
      new.created_by_name := public.actor_display_name(new.created_by);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.updated_by is not null
      and (
        new.updated_by is distinct from old.updated_by
        or new.updated_by_name is null
        or new.updated_at is distinct from old.updated_at
      )
    then
      new.updated_by_name := public.actor_display_name(new.updated_by);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_penalties_set_actor_names on public.penalties;
create trigger trg_penalties_set_actor_names
  before insert or update on public.penalties
  for each row
  execute function public.discipline_set_actor_names();

drop trigger if exists trg_warnings_set_actor_names on public.warnings;
create trigger trg_warnings_set_actor_names
  before insert or update on public.warnings
  for each row
  execute function public.discipline_set_actor_names();

-- Backfill existing discipline rows
update public.penalties p
set created_by_name = public.actor_display_name(p.created_by)
where p.created_by is not null
  and (p.created_by_name is null or trim(p.created_by_name) = '');

update public.penalties p
set updated_by_name = public.actor_display_name(p.updated_by)
where p.updated_by is not null
  and (p.updated_by_name is null or trim(p.updated_by_name) = '');

update public.warnings w
set created_by_name = public.actor_display_name(w.created_by)
where w.created_by is not null
  and (w.created_by_name is null or trim(w.created_by_name) = '');

update public.warnings w
set updated_by_name = public.actor_display_name(w.updated_by)
where w.updated_by is not null
  and (w.updated_by_name is null or trim(w.updated_by_name) = '');
