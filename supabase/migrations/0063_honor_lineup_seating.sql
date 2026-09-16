-- Honor Division seated lineups: open/closed room + N/S/E/W, per-side lock timestamps.

alter table public.match_players
  add column if not exists room text,
  add column if not exists direction text;

alter table public.match_players
  drop constraint if exists match_players_room_check;
alter table public.match_players
  add constraint match_players_room_check
  check (room is null or room in ('open', 'closed'));

alter table public.match_players
  drop constraint if exists match_players_direction_check;
alter table public.match_players
  add constraint match_players_direction_check
  check (direction is null or direction in ('N', 'S', 'E', 'W'));

alter table public.match_players
  drop constraint if exists match_players_room_direction_pair;
alter table public.match_players
  add constraint match_players_room_direction_pair
  check ((room is null) = (direction is null));

create unique index if not exists match_players_match_seat_unique
  on public.match_players (match_id, room, direction)
  where room is not null and direction is not null;

alter table public.matches
  add column if not exists home_lineup_locked_at timestamptz,
  add column if not exists away_lineup_locked_at timestamptz;

comment on column public.match_players.room is
  'Honor seated lineup: open or closed room; null for flat/non-Honor lineups and sitting reserves.';
comment on column public.match_players.direction is
  'Honor seated lineup compass: N/S/E/W; null when room is null.';
comment on column public.matches.home_lineup_locked_at is
  'When the home Honor lineup was submitted/locked; null = draft or non-Honor.';
comment on column public.matches.away_lineup_locked_at is
  'When the away Honor lineup was submitted/locked; null = draft or non-Honor.';
