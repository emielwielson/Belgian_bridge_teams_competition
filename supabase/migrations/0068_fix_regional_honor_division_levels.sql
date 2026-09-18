-- Regional leagues must not use the national Honor division level.
-- Admin regional create previously defaulted to division_levels[0] (honor),
-- which made Liga matches use Honor line-up and Bridgemate scoring UI.

update public.divisions d
set division_level_id = dl_target.id
from public.leagues l,
     public.division_levels dl_current,
     public.division_levels dl_target
where d.league_id = l.id
  and l.scope = 'regional'
  and dl_current.id = d.division_level_id
  and dl_current.code = 'honor'
  and dl_target.code = case
    when d.name ~* '^liga\s*2$' then 'second'
    when d.name ~* '^liga\s*3$' then 'third'
    else 'first'
  end
  and not exists (
    select 1
    from public.divisions other
    where other.league_id = d.league_id
      and other.id <> d.id
      and other.division_level_id = dl_target.id
  );
