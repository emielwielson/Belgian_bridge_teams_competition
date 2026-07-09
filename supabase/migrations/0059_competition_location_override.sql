-- Competition-specific location override on clubs (falls back to membership-managed clubs.location).
-- Centralized venue for divisions where all teams play at one location (e.g. Honor Division).

alter table public.clubs
  add column if not exists competition_location text;

alter table public.divisions
  add column if not exists centralized_location text;
