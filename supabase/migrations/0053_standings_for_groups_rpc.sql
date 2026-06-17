-- Group-scoped standings RPC: avoids full-table aggregation in standings_group view.

create index if not exists matches_group_played_idx
  on public.matches (group_id, round)
  where played_at is not null;

create or replace function public.standings_for_groups(p_group_ids uuid[])
returns table (
  group_id uuid,
  team_id uuid,
  team_name text,
  match_vp_total numeric,
  penalty_vp numeric,
  vp_total numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with match_vp as (
    select
      m.group_id,
      m.home_team_id as team_id,
      coalesce(m.vp_home, 0) as vp
    from public.matches m
    where m.group_id = any(p_group_ids)
      and m.played_at is not null
    union all
    select
      m.group_id,
      m.away_team_id as team_id,
      coalesce(m.vp_away, 0) as vp
    from public.matches m
    where m.group_id = any(p_group_ids)
      and m.played_at is not null
    union all
    select
      gbr.group_id,
      gbr.team_id,
      gbr.vp
    from public.group_bye_rounds gbr
    where gbr.group_id = any(p_group_ids)
      and gbr.awarded_at is not null
  ),
  match_totals as (
    select mv.group_id, mv.team_id, sum(mv.vp) as match_vp_total
    from match_vp mv
    group by mv.group_id, mv.team_id
  ),
  penalty_totals as (
    select
      t.group_id,
      p.team_id,
      coalesce(sum(p.vp_deduction), 0) as penalty_vp
    from public.penalties p
    join public.teams t on t.id = p.team_id
    where t.group_id = any(p_group_ids)
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
  left join penalty_totals pt on pt.team_id = t.id and pt.group_id = t.group_id
  where t.group_id = any(p_group_ids);
$$;

grant execute on function public.standings_for_groups(uuid[]) to anon, authenticated;

-- Return group IDs affected by bye awards so callers can invalidate caches.
drop function if exists public.award_due_bye_scores(uuid);

create or replace function public.award_due_bye_scores(p_season_id uuid default null)
returns table (awarded int, pending int, group_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awarded int := 0;
  v_pending int := 0;
  v_group_ids uuid[];
begin
  with due as (
    select gbr.id, gbr.group_id
    from public.group_bye_rounds gbr
    join public.groups g on g.id = gbr.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    join public.competition_match_dates cmd on
      cmd.season_id = l.season_id
      and cmd.scope = l.scope
      and cmd.region_id is not distinct from l.region_id
      and cmd.division_id is not distinct from public.resolve_group_match_dates_division_id(g.id)
      and cmd.round = gbr.round
    where gbr.awarded_at is null
      and cmd.datetime <= now()
      and (p_season_id is null or l.season_id = p_season_id)
  ),
  updated as (
    update public.group_bye_rounds gbr
    set awarded_at = now()
    from due
    where gbr.id = due.id
    returning gbr.group_id
  )
  select count(*)::int, coalesce(array_agg(distinct group_id), '{}')
  into v_awarded, v_group_ids
  from updated;

  select count(*)::int into v_pending
  from public.group_bye_rounds gbr
  join public.groups g on g.id = gbr.group_id
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where gbr.awarded_at is null
    and (p_season_id is null or l.season_id = p_season_id);

  return query select v_awarded, v_pending, coalesce(v_group_ids, '{}');
end;
$$;

grant execute on function public.award_due_bye_scores(uuid) to service_role;
