-- Canonical national top division name: Honor Division (was Honor in early seeds/demo).

do $$
declare
  v_league_id uuid;
  v_honor_id uuid;
  v_honor_division_id uuid;
begin
  select l.id into v_league_id
  from public.leagues l
  where l.scope = 'national'
    and l.name = 'National'
  order by l.created_at
  limit 1;

  if v_league_id is null then
    return;
  end if;

  select d.id into v_honor_id
  from public.divisions d
  where d.league_id = v_league_id
    and d.name = 'Honor';

  select d.id into v_honor_division_id
  from public.divisions d
  where d.league_id = v_league_id
    and d.name = 'Honor Division';

  if v_honor_id is null then
    return;
  end if;

  if v_honor_division_id is not null then
    -- Both exist: drop legacy Honor division (and its groups) after clearing dependents.
    delete from public.rulings r
    using public.matches m
    join public.groups g on g.id = m.group_id
    where r.match_id = m.id
      and g.division_id = v_honor_id;

    delete from public.matches m
    using public.groups g
    where m.group_id = g.id
      and g.division_id = v_honor_id;

    delete from public.team_players tp
    using public.teams t
    join public.groups g on g.id = t.group_id
    where tp.team_id = t.id
      and g.division_id = v_honor_id;

    update public.teams t
    set captain_id = null
    from public.groups g
    where t.group_id = g.id
      and g.division_id = v_honor_id;

    delete from public.penalties p
    using public.teams t
    join public.groups g on g.id = t.group_id
    where p.team_id = t.id
      and g.division_id = v_honor_id;

    delete from public.warnings w
    using public.teams t
    join public.groups g on g.id = t.group_id
    where w.team_id = t.id
      and g.division_id = v_honor_id;

    delete from public.teams t
    using public.groups g
    where t.group_id = g.id
      and g.division_id = v_honor_id;

    delete from public.vp_table_rows vtr
    using public.vp_tables vt
    join public.groups g on g.id = vt.group_id
    where vtr.vp_table_id = vt.id
      and g.division_id = v_honor_id;

    delete from public.vp_tables vt
    using public.groups g
    where vt.group_id = g.id
      and g.division_id = v_honor_id;

    delete from public.groups g
    where g.division_id = v_honor_id;

    delete from public.divisions d
    where d.id = v_honor_id;
  else
    update public.divisions
    set name = 'Honor Division'
    where id = v_honor_id;

    update public.groups g
    set name = 'Honor Division'
    where g.division_id = v_honor_id
      and g.name = 'Honor';
  end if;
end $$;

create or replace function public.resolve_group_match_dates_division_id(p_group_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_division_name text;
  v_division_id uuid;
begin
  select d.name, d.id into v_division_name, v_division_id
  from public.groups g
  join public.divisions d on d.id = g.division_id
  where g.id = p_group_id;

  if v_division_name in ('Honor', 'Honor Division', '1st Division') then
    return v_division_id;
  end if;

  return null;
end;
$$;

update public.groups g
set round_count = 21
from public.divisions d
join public.leagues l on l.id = d.league_id
where g.division_id = d.id
  and d.name in ('Honor', 'Honor Division')
  and l.scope = 'national'
  and l.name = 'National';
