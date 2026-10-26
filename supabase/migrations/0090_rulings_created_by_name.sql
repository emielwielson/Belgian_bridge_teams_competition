-- Snapshot arbiter/uploader display name on rulings.
-- Dedicated trigger: rulings have no updated_by column (unlike penalties/warnings).

alter table public.rulings
  add column if not exists created_by_name text;

create or replace function public.rulings_set_created_by_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null
    and (
      tg_op = 'INSERT'
      or new.created_by is distinct from old.created_by
      or new.created_by_name is null
      or trim(new.created_by_name) = ''
    )
  then
    new.created_by_name := public.actor_display_name(new.created_by);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rulings_set_created_by_name on public.rulings;
create trigger trg_rulings_set_created_by_name
  before insert or update on public.rulings
  for each row
  execute function public.rulings_set_created_by_name();

update public.rulings r
set created_by_name = public.actor_display_name(r.created_by)
where r.created_by is not null
  and (r.created_by_name is null or trim(r.created_by_name) = '');
