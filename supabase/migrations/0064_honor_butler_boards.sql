-- Honor Division Butler: boards, board results, player combinations, imports, round publication.

-- ---------------------------------------------------------------------------
-- Boards (PBN hand records per tournament round)
-- ---------------------------------------------------------------------------
create table public.honor_boards (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  tournament_round int not null,
  board_number int not null,
  dealer text,
  vulnerability text,
  hands jsonb,
  publication_status text not null default 'draft'
    check (publication_status in ('draft', 'published')),
  ns_datum numeric,
  ew_datum numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint honor_boards_round_positive check (tournament_round > 0),
  constraint honor_boards_board_positive check (board_number > 0),
  constraint honor_boards_dealer_check
    check (dealer is null or dealer in ('N', 'E', 'S', 'W')),
  constraint honor_boards_vulnerability_check
    check (
      vulnerability is null
      or vulnerability in ('NONE', 'NS', 'EW', 'BOTH')
    ),
  constraint honor_boards_group_round_board_unique
    unique (group_id, tournament_round, board_number)
);

create index honor_boards_group_round_idx
  on public.honor_boards (group_id, tournament_round);

comment on table public.honor_boards is
  'Honor Division board distributions (PBN) per tournament round.';

-- ---------------------------------------------------------------------------
-- Player combinations (stable Butler identity across lineups)
-- ---------------------------------------------------------------------------
create table public.honor_player_combinations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  player_low_id uuid not null references public.players (id) on delete restrict,
  player_high_id uuid not null references public.players (id) on delete restrict,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint honor_player_combinations_ordered
    check (player_low_id < player_high_id),
  constraint honor_player_combinations_unique
    unique (group_id, player_low_id, player_high_id)
);

create index honor_player_combinations_group_idx
  on public.honor_player_combinations (group_id);
create index honor_player_combinations_team_idx
  on public.honor_player_combinations (team_id);

comment on table public.honor_player_combinations is
  'Canonical two-player combinations for Honor Butler ranking.';

-- ---------------------------------------------------------------------------
-- Board results (one per match room × board)
-- ---------------------------------------------------------------------------
create table public.honor_board_results (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  room text not null check (room in ('open', 'closed')),
  board_id uuid not null references public.honor_boards (id) on delete cascade,
  tournament_round int not null,

  ns_combination_id uuid references public.honor_player_combinations (id) on delete set null,
  ew_combination_id uuid references public.honor_player_combinations (id) on delete set null,

  contract_level int,
  contract_denomination text
    check (
      contract_denomination is null
      or contract_denomination in ('CLUBS', 'DIAMONDS', 'HEARTS', 'SPADES', 'NT', 'PASS')
    ),
  doubling text not null default 'NONE'
    check (doubling in ('NONE', 'DOUBLED', 'REDOUBLED')),
  declarer text check (declarer is null or declarer in ('N', 'E', 'S', 'W')),
  tricks_result text,
  tricks_taken int,

  ns_score int,
  bridgemate_score int,
  computed_score int,

  ns_butler_imps numeric,
  ew_butler_imps numeric,
  score_diff numeric,
  included_in_datum boolean not null default true,

  import_source text not null default 'bridgemate_bws'
    check (import_source in ('bridgemate_bws', 'manual', 'correction')),
  processing_status text not null default 'imported'
    check (
      processing_status in (
        'imported', 'validated', 'calculated', 'published'
      )
    ),
  validation_status text not null default 'pending'
    check (
      validation_status in ('pending', 'valid', 'invalid', 'special')
    ),
  correction_status text not null default 'original'
    check (correction_status in ('original', 'corrected')),
  special_result_kind text not null default 'none'
    check (
      special_result_kind in (
        'none', 'not_played', 'arbitral', 'adjusted', 'erased'
      )
    ),
  datum_eligible boolean,
  admin_ns_butler_imps numeric,
  admin_adjusted_ns_score int,

  original_payload jsonb,
  validation_errors jsonb,

  imported_at timestamptz,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint honor_board_results_match_room_board_unique
    unique (match_id, room, board_id),
  constraint honor_board_results_round_positive check (tournament_round > 0)
);

create index honor_board_results_group_round_idx
  on public.honor_board_results (group_id, tournament_round);
create index honor_board_results_board_idx
  on public.honor_board_results (board_id);
create index honor_board_results_match_idx
  on public.honor_board_results (match_id);
create index honor_board_results_ns_combo_idx
  on public.honor_board_results (ns_combination_id);
create index honor_board_results_ew_combo_idx
  on public.honor_board_results (ew_combination_id);

comment on table public.honor_board_results is
  'Per-table board results for Honor Butler scoring.';

-- ---------------------------------------------------------------------------
-- Raw imports (audit)
-- ---------------------------------------------------------------------------
create table public.honor_raw_imports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  tournament_round int not null,
  source text not null default 'bridgemate-bws',
  source_identifier text,
  filename text,
  payload jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  errors jsonb,
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint honor_raw_imports_round_positive check (tournament_round > 0)
);

create index honor_raw_imports_group_round_idx
  on public.honor_raw_imports (group_id, tournament_round);

-- ---------------------------------------------------------------------------
-- Round publication
-- ---------------------------------------------------------------------------
create table public.honor_round_publication (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  tournament_round int not null,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint honor_round_publication_round_positive check (tournament_round > 0),
  constraint honor_round_publication_unique unique (group_id, tournament_round)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.honor_boards enable row level security;
alter table public.honor_player_combinations enable row level security;
alter table public.honor_board_results enable row level security;
alter table public.honor_raw_imports enable row level security;
alter table public.honor_round_publication enable row level security;

-- Public: published boards/results/rounds only; combinations always readable
create policy honor_boards_public_read on public.honor_boards
  for select to anon, authenticated
  using (
    publication_status = 'published'
    or public.current_user_is_competition_manager()
    or public.current_user_is_arbiter()
  );

create policy honor_combinations_public_read on public.honor_player_combinations
  for select to anon, authenticated using (true);

create policy honor_board_results_public_read on public.honor_board_results
  for select to anon, authenticated
  using (
    processing_status = 'published'
    or public.current_user_is_competition_manager()
    or public.current_user_is_arbiter()
  );

create policy honor_round_publication_public_read on public.honor_round_publication
  for select to anon, authenticated using (true);

create policy honor_raw_imports_staff_read on public.honor_raw_imports
  for select to authenticated
  using (
    public.current_user_is_competition_manager()
    or public.current_user_is_arbiter()
  );

-- Writes via service role in API routes; managers also get direct write for SQL tools
create policy honor_boards_manager_write on public.honor_boards
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy honor_combinations_manager_write on public.honor_player_combinations
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy honor_board_results_manager_write on public.honor_board_results
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy honor_raw_imports_manager_write on public.honor_raw_imports
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());

create policy honor_round_publication_manager_write on public.honor_round_publication
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());
