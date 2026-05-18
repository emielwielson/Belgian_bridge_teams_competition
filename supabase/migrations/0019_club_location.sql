-- Match venue is stored on the club; teams inherit it for display.

alter table public.clubs
  add column if not exists location text;

-- Seed club location from existing per-team values (first non-empty per club).
update public.clubs c
set location = sub.location
from (
  select distinct on (t.club_id)
    t.club_id,
    trim(t.location) as location
  from public.teams t
  where t.location is not null
    and trim(t.location) <> ''
  order by t.club_id, t.created_at
) sub
where c.id = sub.club_id
  and (c.location is null or trim(c.location) = '');
