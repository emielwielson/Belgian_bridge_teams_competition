-- Replace MVP 3-band VP rows with WBF 24-board scale (auto-generated from standard-vp-bands.ts)

delete from public.vp_table_rows r
using public.vp_tables vt
where r.vp_table_id = vt.id
  and vt.board_count = 24
  and vt.name = 'Standard 24 boards';

insert into public.vp_table_rows (vp_table_id, imp_min, imp_max, vp_home, vp_away)
select vt.id, bands.imp_min, bands.imp_max, bands.vp_home, bands.vp_away
from public.vp_tables vt
cross join (
  values
    (-999::numeric, -75::numeric, 0::numeric, 20::numeric),
    (-74::numeric, -74::numeric, 0::numeric, 20::numeric),
    (-73::numeric, -73::numeric, 0.03::numeric, 19.97::numeric),
    (-72::numeric, -72::numeric, 0.09::numeric, 19.91::numeric),
    (-71::numeric, -71::numeric, 0.15::numeric, 19.85::numeric),
    (-70::numeric, -70::numeric, 0.21::numeric, 19.79::numeric),
    (-69::numeric, -69::numeric, 0.28::numeric, 19.72::numeric),
    (-68::numeric, -68::numeric, 0.35::numeric, 19.65::numeric),
    (-67::numeric, -67::numeric, 0.42::numeric, 19.58::numeric),
    (-66::numeric, -66::numeric, 0.49::numeric, 19.51::numeric),
    (-65::numeric, -65::numeric, 0.56::numeric, 19.44::numeric),
    (-64::numeric, -64::numeric, 0.63::numeric, 19.37::numeric),
    (-63::numeric, -63::numeric, 0.7::numeric, 19.3::numeric),
    (-62::numeric, -62::numeric, 0.78::numeric, 19.22::numeric),
    (-61::numeric, -61::numeric, 0.86::numeric, 19.14::numeric),
    (-60::numeric, -60::numeric, 0.94::numeric, 19.06::numeric),
    (-59::numeric, -59::numeric, 1.02::numeric, 18.98::numeric),
    (-58::numeric, -58::numeric, 1.1::numeric, 18.9::numeric),
    (-57::numeric, -57::numeric, 1.18::numeric, 18.82::numeric),
    (-56::numeric, -56::numeric, 1.26::numeric, 18.74::numeric),
    (-55::numeric, -55::numeric, 1.35::numeric, 18.65::numeric),
    (-54::numeric, -54::numeric, 1.44::numeric, 18.56::numeric),
    (-53::numeric, -53::numeric, 1.53::numeric, 18.47::numeric),
    (-52::numeric, -52::numeric, 1.62::numeric, 18.38::numeric),
    (-51::numeric, -51::numeric, 1.71::numeric, 18.29::numeric),
    (-50::numeric, -50::numeric, 1.81::numeric, 18.19::numeric),
    (-49::numeric, -49::numeric, 1.91::numeric, 18.09::numeric),
    (-48::numeric, -48::numeric, 2.01::numeric, 17.99::numeric),
    (-47::numeric, -47::numeric, 2.11::numeric, 17.89::numeric),
    (-46::numeric, -46::numeric, 2.21::numeric, 17.79::numeric),
    (-45::numeric, -45::numeric, 2.31::numeric, 17.69::numeric),
    (-44::numeric, -44::numeric, 2.42::numeric, 17.58::numeric),
    (-43::numeric, -43::numeric, 2.53::numeric, 17.47::numeric),
    (-42::numeric, -42::numeric, 2.64::numeric, 17.36::numeric),
    (-41::numeric, -41::numeric, 2.75::numeric, 17.25::numeric),
    (-40::numeric, -40::numeric, 2.87::numeric, 17.13::numeric),
    (-39::numeric, -39::numeric, 2.99::numeric, 17.01::numeric),
    (-38::numeric, -38::numeric, 3.11::numeric, 16.89::numeric),
    (-37::numeric, -37::numeric, 3.23::numeric, 16.77::numeric),
    (-36::numeric, -36::numeric, 3.36::numeric, 16.64::numeric),
    (-35::numeric, -35::numeric, 3.49::numeric, 16.51::numeric),
    (-34::numeric, -34::numeric, 3.62::numeric, 16.38::numeric),
    (-33::numeric, -33::numeric, 3.75::numeric, 16.25::numeric),
    (-32::numeric, -32::numeric, 3.89::numeric, 16.11::numeric),
    (-31::numeric, -31::numeric, 4.03::numeric, 15.97::numeric),
    (-30::numeric, -30::numeric, 4.17::numeric, 15.83::numeric),
    (-29::numeric, -29::numeric, 4.31::numeric, 15.69::numeric),
    (-28::numeric, -28::numeric, 4.46::numeric, 15.54::numeric),
    (-27::numeric, -27::numeric, 4.61::numeric, 15.39::numeric),
    (-26::numeric, -26::numeric, 4.76::numeric, 15.24::numeric),
    (-25::numeric, -25::numeric, 4.92::numeric, 15.08::numeric),
    (-24::numeric, -24::numeric, 5.08::numeric, 14.92::numeric),
    (-23::numeric, -23::numeric, 5.24::numeric, 14.76::numeric),
    (-22::numeric, -22::numeric, 5.4::numeric, 14.6::numeric),
    (-21::numeric, -21::numeric, 5.57::numeric, 14.43::numeric),
    (-20::numeric, -20::numeric, 5.74::numeric, 14.26::numeric),
    (-19::numeric, -19::numeric, 5.92::numeric, 14.08::numeric),
    (-18::numeric, -18::numeric, 6.1::numeric, 13.9::numeric),
    (-17::numeric, -17::numeric, 6.28::numeric, 13.72::numeric),
    (-16::numeric, -16::numeric, 6.47::numeric, 13.53::numeric),
    (-15::numeric, -15::numeric, 6.66::numeric, 13.34::numeric),
    (-14::numeric, -14::numeric, 6.85::numeric, 13.15::numeric),
    (-13::numeric, -13::numeric, 7.05::numeric, 12.95::numeric),
    (-12::numeric, -12::numeric, 7.25::numeric, 12.75::numeric),
    (-11::numeric, -11::numeric, 7.46::numeric, 12.54::numeric),
    (-10::numeric, -10::numeric, 7.67::numeric, 12.33::numeric),
    (-9::numeric, -9::numeric, 7.88::numeric, 12.12::numeric),
    (-8::numeric, -8::numeric, 8.1::numeric, 11.9::numeric),
    (-7::numeric, -7::numeric, 8.32::numeric, 11.68::numeric),
    (-6::numeric, -6::numeric, 8.54::numeric, 11.46::numeric),
    (-5::numeric, -5::numeric, 8.77::numeric, 11.23::numeric),
    (-4::numeric, -4::numeric, 9.01::numeric, 10.99::numeric),
    (-3::numeric, -3::numeric, 9.25::numeric, 10.75::numeric),
    (-2::numeric, -2::numeric, 9.5::numeric, 10.5::numeric),
    (-1::numeric, -1::numeric, 9.75::numeric, 10.25::numeric),
    (0::numeric, 0::numeric, 10::numeric, 10::numeric),
    (1::numeric, 1::numeric, 10.25::numeric, 9.75::numeric),
    (2::numeric, 2::numeric, 10.5::numeric, 9.5::numeric),
    (3::numeric, 3::numeric, 10.75::numeric, 9.25::numeric),
    (4::numeric, 4::numeric, 10.99::numeric, 9.01::numeric),
    (5::numeric, 5::numeric, 11.23::numeric, 8.77::numeric),
    (6::numeric, 6::numeric, 11.46::numeric, 8.54::numeric),
    (7::numeric, 7::numeric, 11.68::numeric, 8.32::numeric),
    (8::numeric, 8::numeric, 11.9::numeric, 8.1::numeric),
    (9::numeric, 9::numeric, 12.12::numeric, 7.88::numeric),
    (10::numeric, 10::numeric, 12.33::numeric, 7.67::numeric),
    (11::numeric, 11::numeric, 12.54::numeric, 7.46::numeric),
    (12::numeric, 12::numeric, 12.75::numeric, 7.25::numeric),
    (13::numeric, 13::numeric, 12.95::numeric, 7.05::numeric),
    (14::numeric, 14::numeric, 13.15::numeric, 6.85::numeric),
    (15::numeric, 15::numeric, 13.34::numeric, 6.66::numeric),
    (16::numeric, 16::numeric, 13.53::numeric, 6.47::numeric),
    (17::numeric, 17::numeric, 13.72::numeric, 6.28::numeric),
    (18::numeric, 18::numeric, 13.9::numeric, 6.1::numeric),
    (19::numeric, 19::numeric, 14.08::numeric, 5.92::numeric),
    (20::numeric, 20::numeric, 14.26::numeric, 5.74::numeric),
    (21::numeric, 21::numeric, 14.43::numeric, 5.57::numeric),
    (22::numeric, 22::numeric, 14.6::numeric, 5.4::numeric),
    (23::numeric, 23::numeric, 14.76::numeric, 5.24::numeric),
    (24::numeric, 24::numeric, 14.92::numeric, 5.08::numeric),
    (25::numeric, 25::numeric, 15.08::numeric, 4.92::numeric),
    (26::numeric, 26::numeric, 15.24::numeric, 4.76::numeric),
    (27::numeric, 27::numeric, 15.39::numeric, 4.61::numeric),
    (28::numeric, 28::numeric, 15.54::numeric, 4.46::numeric),
    (29::numeric, 29::numeric, 15.69::numeric, 4.31::numeric),
    (30::numeric, 30::numeric, 15.83::numeric, 4.17::numeric),
    (31::numeric, 31::numeric, 15.97::numeric, 4.03::numeric),
    (32::numeric, 32::numeric, 16.11::numeric, 3.89::numeric),
    (33::numeric, 33::numeric, 16.25::numeric, 3.75::numeric),
    (34::numeric, 34::numeric, 16.38::numeric, 3.62::numeric),
    (35::numeric, 35::numeric, 16.51::numeric, 3.49::numeric),
    (36::numeric, 36::numeric, 16.64::numeric, 3.36::numeric),
    (37::numeric, 37::numeric, 16.77::numeric, 3.23::numeric),
    (38::numeric, 38::numeric, 16.89::numeric, 3.11::numeric),
    (39::numeric, 39::numeric, 17.01::numeric, 2.99::numeric),
    (40::numeric, 40::numeric, 17.13::numeric, 2.87::numeric),
    (41::numeric, 41::numeric, 17.25::numeric, 2.75::numeric),
    (42::numeric, 42::numeric, 17.36::numeric, 2.64::numeric),
    (43::numeric, 43::numeric, 17.47::numeric, 2.53::numeric),
    (44::numeric, 44::numeric, 17.58::numeric, 2.42::numeric),
    (45::numeric, 45::numeric, 17.69::numeric, 2.31::numeric),
    (46::numeric, 46::numeric, 17.79::numeric, 2.21::numeric),
    (47::numeric, 47::numeric, 17.89::numeric, 2.11::numeric),
    (48::numeric, 48::numeric, 17.99::numeric, 2.01::numeric),
    (49::numeric, 49::numeric, 18.09::numeric, 1.91::numeric),
    (50::numeric, 50::numeric, 18.19::numeric, 1.81::numeric),
    (51::numeric, 51::numeric, 18.29::numeric, 1.71::numeric),
    (52::numeric, 52::numeric, 18.38::numeric, 1.62::numeric),
    (53::numeric, 53::numeric, 18.47::numeric, 1.53::numeric),
    (54::numeric, 54::numeric, 18.56::numeric, 1.44::numeric),
    (55::numeric, 55::numeric, 18.65::numeric, 1.35::numeric),
    (56::numeric, 56::numeric, 18.74::numeric, 1.26::numeric),
    (57::numeric, 57::numeric, 18.82::numeric, 1.18::numeric),
    (58::numeric, 58::numeric, 18.9::numeric, 1.1::numeric),
    (59::numeric, 59::numeric, 18.98::numeric, 1.02::numeric),
    (60::numeric, 60::numeric, 19.06::numeric, 0.94::numeric),
    (61::numeric, 61::numeric, 19.14::numeric, 0.86::numeric),
    (62::numeric, 62::numeric, 19.22::numeric, 0.78::numeric),
    (63::numeric, 63::numeric, 19.3::numeric, 0.7::numeric),
    (64::numeric, 64::numeric, 19.37::numeric, 0.63::numeric),
    (65::numeric, 65::numeric, 19.44::numeric, 0.56::numeric),
    (66::numeric, 66::numeric, 19.51::numeric, 0.49::numeric),
    (67::numeric, 67::numeric, 19.58::numeric, 0.42::numeric),
    (68::numeric, 68::numeric, 19.65::numeric, 0.35::numeric),
    (69::numeric, 69::numeric, 19.72::numeric, 0.28::numeric),
    (70::numeric, 70::numeric, 19.79::numeric, 0.21::numeric),
    (71::numeric, 71::numeric, 19.85::numeric, 0.15::numeric),
    (72::numeric, 72::numeric, 19.91::numeric, 0.09::numeric),
    (73::numeric, 73::numeric, 19.97::numeric, 0.03::numeric),
    (74::numeric, 74::numeric, 20::numeric, 0::numeric),
    (75::numeric, 999::numeric, 20::numeric, 0::numeric)
) as bands(imp_min, imp_max, vp_home, vp_away)
where vt.board_count = 24
  and vt.name = 'Standard 24 boards';

-- Recalculate VP on scored matches that used the old 3-band table
alter table public.matches disable trigger matches_score_edit_policy;

update public.matches m
set
  vp_home = v.vp_home,
  vp_away = v.vp_away
from (
  select
    m2.id as match_id,
    l.vp_home,
    l.vp_away
  from public.matches m2
  cross join lateral public.lookup_vp_for_match(
    m2.id,
    m2.imps_home,
    m2.imps_away
  ) l
  where m2.played_at is not null
    and m2.imps_home is not null
    and m2.imps_away is not null
) v
where m.id = v.match_id;

alter table public.matches enable trigger matches_score_edit_policy;
