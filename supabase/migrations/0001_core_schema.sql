-- Task 1.2: Core competition schema (PRD §4.1–4.6, §4.5)

create extension if not exists pgcrypto;

-- Regions (FR 9)
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint regions_code_check check (code in ('flanders', 'wallonia')),
  constraint regions_code_unique unique (code)
);

-- Seasons (FR 6–8)
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'setup',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_status_check check (status in ('setup', 'active', 'finished'))
);

-- Division catalog: Honor, 1st, 2nd, 3rd (FR 3)
create table public.division_levels (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  sort_order int not null,
  created_at timestamptz not null default now(),
  constraint division_levels_code_unique unique (code),
  constraint division_levels_sort_order_unique unique (sort_order)
);

-- Leagues (FR 1–2)
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete restrict,
  scope text not null,
  region_id uuid references public.regions (id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  constraint leagues_scope_check check (scope in ('national', 'regional')),
  constraint leagues_regional_region_check check (
    (scope = 'national' and region_id is null)
    or (scope = 'regional' and region_id is not null)
  )
);

-- Divisions within a league (FR 1)
create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete restrict,
  division_level_id uuid not null references public.division_levels (id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  constraint divisions_league_level_unique unique (league_id, division_level_id)
);

-- Groups (FR 4)
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.divisions (id) on delete restrict,
  name text not null,
  max_matches_per_day_per_team int,
  status text not null default 'setup',
  created_at timestamptz not null default now(),
  constraint groups_status_check check (status in ('setup', 'active', 'finished'))
);

-- Clubs & players (FR 10–12)
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_id uuid not null references public.regions (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  member_number text,
  email text,
  created_at timestamptz not null default now(),
  constraint players_email_unique unique (email)
);

create table public.player_club_memberships (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete restrict,
  club_id uuid not null references public.clubs (id) on delete restrict,
  season_id uuid not null references public.seasons (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Teams & rosters (FR 14–16)
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  club_id uuid not null references public.clubs (id) on delete restrict,
  name text not null,
  captain_id uuid references public.players (id) on delete set null,
  location text,
  created_at timestamptz not null default now()
);

create table public.team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete restrict,
  player_id uuid not null references public.players (id) on delete restrict,
  season_id uuid not null references public.seasons (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Matches (FR 20–21)
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  round int not null,
  datetime timestamptz not null,
  home_team_id uuid not null references public.teams (id) on delete restrict,
  away_team_id uuid not null references public.teams (id) on delete restrict,
  board_count int not null,
  imps_home numeric,
  imps_away numeric,
  vp_home numeric,
  vp_away numeric,
  played_at timestamptz,
  last_modified_by uuid references auth.users (id) on delete set null,
  last_modified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint matches_round_positive check (round > 0),
  constraint matches_board_count_positive check (board_count > 0)
);

-- Match lineups (FR 27–31)
create table public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  player_id uuid not null references public.players (id) on delete restrict,
  is_substitute boolean not null default false,
  created_at timestamptz not null default now(),
  constraint match_players_unique unique (match_id, team_id, player_id)
);
