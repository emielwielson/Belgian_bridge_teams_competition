-- National has multiple divisions per level (e.g. 2nd A + 2nd B both "second").

alter table public.divisions
  drop constraint if exists divisions_league_level_unique;

alter table public.divisions
  add constraint divisions_league_name_unique unique (league_id, name);
