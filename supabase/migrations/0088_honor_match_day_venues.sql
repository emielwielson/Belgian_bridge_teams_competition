-- Per-match-day venues for Honor Division (Eredivisie): 7 days × 3 rounds.

create table public.division_match_day_venues (
  division_id uuid not null references public.divisions (id) on delete cascade,
  match_day_index smallint not null,
  location text not null,
  constraint division_match_day_venues_pkey
    primary key (division_id, match_day_index),
  constraint division_match_day_venues_day_check
    check (match_day_index between 1 and 7),
  constraint division_match_day_venues_location_nonempty
    check (length(trim(location)) > 0)
);

create index division_match_day_venues_division_id_idx
  on public.division_match_day_venues (division_id);

alter table public.division_match_day_venues enable row level security;

create policy division_match_day_venues_public_read
  on public.division_match_day_venues
  for select to anon, authenticated
  using (true);

create policy division_match_day_venues_manager_write
  on public.division_match_day_venues
  for all to authenticated
  using (public.current_user_is_competition_manager())
  with check (public.current_user_is_competition_manager());
