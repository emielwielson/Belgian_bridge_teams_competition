-- Task 1.6: Reference data (idempotent)

insert into public.regions (code, name)
values
  ('flanders', 'Flanders'),
  ('wallonia', 'Wallonia')
on conflict (code) do nothing;

insert into public.division_levels (code, name, sort_order)
values
  ('honor', 'Honor', 1),
  ('first', '1st Division', 2),
  ('second', '2nd Division', 3),
  ('third', '3rd Division', 4)
on conflict (code) do nothing;

insert into public.seasons (name, status, is_active)
select '2025-26', 'setup', true
where not exists (
  select 1 from public.seasons where name = '2025-26'
);

-- Minimal league structure for VP template rows (no clubs/teams)
insert into public.leagues (season_id, scope, region_id, name)
select s.id, 'national', null, 'National League'
from public.seasons s
where s.name = '2025-26'
  and not exists (
    select 1
    from public.leagues l
    where l.season_id = s.id
      and l.name = 'National League'
  );

insert into public.divisions (league_id, division_level_id, name)
select l.id, dl.id, 'Honor Division'
from public.leagues l
join public.seasons s on s.id = l.season_id and s.name = '2025-26'
join public.division_levels dl on dl.code = 'honor'
where l.name = 'National League'
  and not exists (
    select 1 from public.divisions d
    where d.league_id = l.id and d.division_level_id = dl.id
  );

insert into public.groups (division_id, name, max_matches_per_day_per_team)
select d.id, 'VP Template Group', null
from public.divisions d
join public.leagues l on l.id = d.league_id
where d.name = 'Honor Division'
  and not exists (
    select 1 from public.groups g
    where g.division_id = d.id and g.name = 'VP Template Group'
  );

-- 24-board IMP → VP sample bands (verify against competition rules before production)
insert into public.vp_tables (group_id, board_count, name)
select g.id, 24, 'Standard 24 boards'
from public.groups g
where g.name = 'VP Template Group'
on conflict (group_id, board_count) do nothing;

insert into public.vp_table_rows (vp_table_id, imp_min, imp_max, vp_home, vp_away)
select vt.id, bands.imp_min, bands.imp_max, bands.vp_home, bands.vp_away
from public.vp_tables vt
join public.groups g on g.id = vt.group_id and g.name = 'VP Template Group'
cross join (
  values
    (-999::numeric, -50::numeric, 0::numeric, 24::numeric),
    (-49::numeric, 0::numeric, 12::numeric, 12::numeric),
    (1::numeric, 999::numeric, 24::numeric, 0::numeric)
) as bands(imp_min, imp_max, vp_home, vp_away)
where not exists (
  select 1 from public.vp_table_rows r where r.vp_table_id = vt.id
);
