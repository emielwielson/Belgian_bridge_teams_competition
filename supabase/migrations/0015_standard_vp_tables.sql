-- Standard 24-board VP tables for groups missing them (demo / UAT scoring)

insert into public.vp_tables (group_id, board_count, name)
select g.id, 24, 'Standard 24 boards'
from public.groups g
where not exists (
  select 1
  from public.vp_tables vt
  where vt.group_id = g.id
    and vt.board_count = 24
);

insert into public.vp_table_rows (vp_table_id, imp_min, imp_max, vp_home, vp_away)
select vt.id, bands.imp_min, bands.imp_max, bands.vp_home, bands.vp_away
from public.vp_tables vt
cross join (
  values
    (-999::numeric, -50::numeric, 0::numeric, 24::numeric),
    (-49::numeric, 0::numeric, 12::numeric, 12::numeric),
    (1::numeric, 999::numeric, 24::numeric, 0::numeric)
) as bands(imp_min, imp_max, vp_home, vp_away)
where vt.board_count = 24
  and vt.name = 'Standard 24 boards'
  and not exists (
    select 1 from public.vp_table_rows r where r.vp_table_id = vt.id
  );
