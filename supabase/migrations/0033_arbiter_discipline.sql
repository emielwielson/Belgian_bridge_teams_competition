-- Arbiter discipline: penalties with optional docs, rulings on resolve, score edit, standings columns

alter table public.penalties
  add column if not exists file_path text;

alter table public.rulings
  alter column board drop not null;

alter table public.rulings
  drop constraint if exists rulings_board_positive;

alter table public.rulings
  add constraint rulings_board_positive_when_set
    check (board is null or board > 0);

alter table public.rulings
  add column if not exists arbiter_request_id uuid references public.arbiter_requests (id) on delete set null;

create unique index if not exists rulings_arbiter_request_id_unique
  on public.rulings (arbiter_request_id)
  where arbiter_request_id is not null;

-- Finished-score edit: arbiters and competition managers
create or replace function public.current_user_can_admin_edit_score(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_competition_manager()
    or public.current_user_is_arbiter();
$$;

create or replace function public.current_user_can_view_match_ops(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_submit_score(p_match_id)
    or public.current_user_is_arbiter();
$$;

create or replace function public.enforce_match_score_edit_policy()
returns trigger
language plpgsql
as $$
begin
  if old.played_at is not null
    and (
      new.imps_home is distinct from old.imps_home
      or new.imps_away is distinct from old.imps_away
      or new.vp_home is distinct from old.vp_home
      or new.vp_away is distinct from old.vp_away
    )
    and not (
      public.current_user_is_competition_manager()
      or public.current_user_is_arbiter()
    )
  then
    raise exception 'Score edits after match is played require arbiter or competition manager';
  end if;

  if (
    new.imps_home is distinct from old.imps_home
    or new.imps_away is distinct from old.imps_away
    or new.vp_home is distinct from old.vp_home
    or new.vp_away is distinct from old.vp_away
  ) then
    new.last_modified_by := auth.uid();
    new.last_modified_at := now();
  end if;

  return new;
end;
$$;

-- Penalties: arbiters may write
drop policy if exists penalties_manager_write on public.penalties;

create policy penalties_discipline_write on public.penalties
  for all to authenticated
  using (
    public.current_user_is_competition_manager()
    or public.current_user_is_arbiter()
  )
  with check (
    public.current_user_is_competition_manager()
    or public.current_user_is_arbiter()
  );

-- Rulings: arbiters may write
drop policy if exists rulings_manager_write on public.rulings;

create policy rulings_discipline_write on public.rulings
  for all to authenticated
  using (
    public.current_user_is_competition_manager()
    or public.current_user_is_arbiter()
  )
  with check (
    public.current_user_is_competition_manager()
    or public.current_user_is_arbiter()
  );

-- Standings: expose match and penalty VP components
-- CREATE OR REPLACE cannot insert columns before vp_total; drop and recreate.
drop view if exists public.standings_group;

create view public.standings_group as
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
  union all
  select
    gbr.group_id,
    gbr.team_id,
    gbr.vp
  from public.group_bye_rounds gbr
  where gbr.awarded_at is not null
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
  coalesce(mt.match_vp_total, 0) as match_vp_total,
  coalesce(pt.penalty_vp, 0) as penalty_vp,
  coalesce(mt.match_vp_total, 0) - coalesce(pt.penalty_vp, 0) as vp_total
from public.teams t
left join match_totals mt on mt.team_id = t.id and mt.group_id = t.group_id
left join penalty_totals pt on pt.team_id = t.id and pt.group_id = t.group_id;

alter view public.standings_group set (security_invoker = true);

grant select on public.standings_group to anon, authenticated;

-- Resolve arbiter request with required ruling document
drop function if exists public.arbiter_request_resolve(uuid);

create or replace function public.arbiter_request_resolve(
  p_request_id uuid,
  p_ruling_file_path text,
  p_board int default null,
  p_ruling_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.arbiter_requests%rowtype;
  v_file_path text;
  v_ruling_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.current_user_is_arbiter()
    and not public.current_user_is_competition_manager() then
    raise exception 'Only an arbiter or competition manager may resolve requests';
  end if;

  v_file_path := nullif(trim(p_ruling_file_path), '');
  if v_file_path is null then
    raise exception 'Ruling document is required';
  end if;

  if p_board is not null and p_board <= 0 then
    raise exception 'Board must be positive when provided';
  end if;

  select * into v_request
  from public.arbiter_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'Arbiter request not found';
  end if;

  if v_request.status <> 'open' then
    raise exception 'Arbiter request is already resolved';
  end if;

  insert into public.rulings (
    match_id,
    board,
    file_path,
    ruling_date,
    arbiter_request_id,
    created_by
  )
  values (
    v_request.match_id,
    p_board,
    v_file_path,
    coalesce(p_ruling_date, current_date),
    p_request_id,
    auth.uid()
  )
  returning id into v_ruling_id;

  update public.arbiter_requests
  set
    status = 'resolved',
    resolved_by = auth.uid(),
    resolved_at = now(),
    updated_at = now()
  where id = p_request_id;

  insert into public.match_logs (match_id, action, user_id)
  values (v_request.match_id, 'ruling_created', auth.uid());

  insert into public.match_logs (match_id, action, user_id)
  values (v_request.match_id, 'arbiter_request_resolved', auth.uid());

  return v_ruling_id;
end;
$$;

grant execute on function public.arbiter_request_resolve(uuid, text, int, date) to authenticated;
