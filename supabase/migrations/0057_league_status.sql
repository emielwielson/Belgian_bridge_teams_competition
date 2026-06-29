-- Per-competition-unit setup locking (national + regional leagues).

alter table public.leagues
  add column if not exists status text not null default 'setup';

alter table public.leagues
  drop constraint if exists leagues_status_check;

alter table public.leagues
  add constraint leagues_status_check check (status in ('setup', 'active', 'finished'));

update public.leagues l
set status = 'active'
where exists (
  select 1
  from public.groups g
  join public.divisions d on d.id = g.division_id
  where d.league_id = l.id
    and g.status = 'active'
);
