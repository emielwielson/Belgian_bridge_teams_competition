-- Task 1.4: VP tables, discipline, audit, standings (PRD §4.7–4.9, §4.12)

-- VP tables scoped to group + board count (FR 38–39)
create table public.vp_tables (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  board_count int not null,
  name text,
  created_at timestamptz not null default now(),
  constraint vp_tables_group_board_unique unique (group_id, board_count),
  constraint vp_tables_board_count_positive check (board_count > 0)
);

create table public.vp_table_rows (
  id uuid primary key default gen_random_uuid(),
  vp_table_id uuid not null references public.vp_tables (id) on delete cascade,
  imp_min numeric not null,
  imp_max numeric not null,
  vp_home numeric not null,
  vp_away numeric not null,
  created_at timestamptz not null default now(),
  constraint vp_table_rows_imp_range check (imp_min <= imp_max)
);

-- Discipline (FR 44–46)
create table public.penalties (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete restrict,
  penalty_date date not null,
  reason text not null,
  vp_deduction numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.warnings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete restrict,
  warning_date date not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.rulings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete restrict,
  board int not null,
  file_path text not null,
  created_at timestamptz not null default now(),
  constraint rulings_board_positive check (board > 0)
);

-- Match audit log (FR 57–58)
create table public.match_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  action text not null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index match_logs_match_id_idx on public.match_logs (match_id);
create index penalties_team_id_idx on public.penalties (team_id);
create index vp_table_rows_vp_table_id_idx on public.vp_table_rows (vp_table_id);

-- Mark match played on first score (FR 36) — minimal trigger
create or replace function public.set_match_played_on_score()
returns trigger
language plpgsql
as $$
begin
  if new.imps_home is not null and new.imps_away is not null and new.played_at is null then
    new.played_at := now();
  end if;
  return new;
end;
$$;

create trigger matches_set_played_at
  before insert or update of imps_home, imps_away on public.matches
  for each row
  execute function public.set_match_played_on_score();

-- Standings per group (FR 40–43): scored matches + penalty deductions
create or replace view public.standings_group as
with match_vp as (
  select
    m.group_id,
    m.home_team_id as team_id,
    coalesce(m.vp_home, 0) as vp
  from public.matches m
  where m.played_at is not null
  union all
  select
    m.group_id,
    m.away_team_id as team_id,
    coalesce(m.vp_away, 0) as vp
  from public.matches m
  where m.played_at is not null
),
match_totals as (
  select group_id, team_id, sum(vp) as match_vp_total
  from match_vp
  group by group_id, team_id
),
penalty_totals as (
  select
    t.group_id,
    p.team_id,
    coalesce(sum(p.vp_deduction), 0) as penalty_vp
  from public.penalties p
  join public.teams t on t.id = p.team_id
  group by t.group_id, p.team_id
)
select
  t.group_id,
  t.id as team_id,
  t.name as team_name,
  coalesce(mt.match_vp_total, 0) - coalesce(pt.penalty_vp, 0) as vp_total
from public.teams t
left join match_totals mt on mt.team_id = t.id and mt.group_id = t.group_id
left join penalty_totals pt on pt.team_id = t.id and pt.group_id = t.group_id;
