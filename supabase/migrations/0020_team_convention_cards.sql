-- Team convention cards: metadata + storage path; public read, team-side write.

create table public.team_convention_cards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  storage_path text not null,
  file_mime text not null,
  file_size_bytes bigint not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint team_convention_cards_name_nonempty check (char_length(trim(name)) > 0),
  constraint team_convention_cards_size_positive check (file_size_bytes > 0)
);

create index team_convention_cards_team_id_idx
  on public.team_convention_cards (team_id);

create index team_convention_cards_team_updated_idx
  on public.team_convention_cards (team_id, updated_at desc);

create or replace function public.current_user_on_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_players tp
    join public.teams t on t.id = tp.team_id
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues lg on lg.id = d.league_id
    where tp.team_id = p_team_id
      and tp.player_id = public.current_user_player_id()
      and tp.season_id = lg.season_id
      and public.current_user_player_id() is not null
  );
$$;

create or replace function public.current_user_can_manage_team_convention_cards(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_competition_manager()
    or exists (
      select 1
      from public.teams t
      where t.id = p_team_id
        and public.current_user_manages_club(t.club_id)
    )
    or public.current_user_on_team(p_team_id);
$$;

grant execute on function public.current_user_on_team(uuid) to authenticated;
grant execute on function public.current_user_can_manage_team_convention_cards(uuid) to authenticated;

alter table public.team_convention_cards enable row level security;

create policy team_convention_cards_public_read on public.team_convention_cards
  for select to anon, authenticated
  using (true);

create policy team_convention_cards_manage_insert on public.team_convention_cards
  for insert to authenticated
  with check (public.current_user_can_manage_team_convention_cards(team_id));

create policy team_convention_cards_manage_update on public.team_convention_cards
  for update to authenticated
  using (public.current_user_can_manage_team_convention_cards(team_id))
  with check (public.current_user_can_manage_team_convention_cards(team_id));

create policy team_convention_cards_manage_delete on public.team_convention_cards
  for delete to authenticated
  using (public.current_user_can_manage_team_convention_cards(team_id));

-- Storage bucket (public read for downloads on team page)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'convention-cards',
  'convention-cards',
  true,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
