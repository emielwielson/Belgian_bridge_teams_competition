-- Rebuild Honor Division national match dates (rounds 1–3, 4–6, … per day).
-- Run in Supabase SQL editor as postgres.
--
-- After running:
--   POST /api/admin/competition/groups/<honor_group_id>/generate
--   POST /api/admin/competition/groups/<honor_group_id>/revalidate

do $$
declare
  v_season_id uuid;
  v_division_id uuid;
  v_group_id uuid;
  v_match_days date[] := array[]::date[];
  v_day date;
  v_day_index int;
  v_slot_index int;
  v_round int;
  v_anchor_round int;
  v_slot_times text[] := array['11:00', '13:50', '16:40'];
begin
  select s.id into v_season_id
  from public.seasons s
  where s.is_active = true
  limit 1;

  if v_season_id is null then
    raise exception 'No active season found';
  end if;

  select d.id into v_division_id
  from public.divisions d
  join public.leagues l on l.id = d.league_id
  where l.season_id = v_season_id
    and l.scope = 'national'
    and d.name = 'Honor Division'
  limit 1;

  if v_division_id is null then
    raise exception 'Honor Division not found for active national season';
  end if;

  select g.id into v_group_id
  from public.groups g
  where g.division_id = v_division_id
  limit 1;

  -- One match day per anchor round 1, 4, 7, …, 19 (fallback: first-leg round 1–7).
  for v_day_index in 0..6 loop
    v_anchor_round := v_day_index * 3 + 1;

    select (cmd.datetime at time zone 'Europe/Brussels')::date
    into v_day
    from public.competition_match_dates cmd
    where cmd.season_id = v_season_id
      and cmd.scope = 'national'
      and cmd.division_id = v_division_id
      and cmd.round = v_anchor_round;

    if v_day is null then
      select (cmd.datetime at time zone 'Europe/Brussels')::date
      into v_day
      from public.competition_match_dates cmd
      where cmd.season_id = v_season_id
        and cmd.scope = 'national'
        and cmd.division_id = v_division_id
        and cmd.round = v_day_index + 1;
    end if;

    if v_day is null then
      raise exception 'Missing competition_match_dates for honor match day %', v_day_index + 1;
    end if;

    v_match_days := array_append(v_match_days, v_day);
  end loop;

  raise notice 'Honor Division match days: %', v_match_days;

  delete from public.competition_match_dates
  where season_id = v_season_id
    and scope = 'national'
    and division_id = v_division_id;

  for v_day_index in 0..6 loop
    for v_slot_index in 0..2 loop
      v_round := v_day_index * 3 + v_slot_index + 1;

      insert into public.competition_match_dates (
        season_id,
        scope,
        region_id,
        division_id,
        round,
        datetime
      )
      values (
        v_season_id,
        'national',
        null,
        v_division_id,
        v_round,
        (v_match_days[v_day_index + 1]::text || ' ' || v_slot_times[v_slot_index + 1])::timestamp
          at time zone 'Europe/Brussels'
      );
    end loop;
  end loop;

  update public.groups
  set max_matches_per_day_per_team = 3
  where id = v_group_id;

  if v_group_id is not null then
    alter table public.matches disable trigger matches_block_delete_active;

    delete from public.rulings r
    using public.matches m
    where r.match_id = m.id
      and m.group_id = v_group_id;

    delete from public.group_bye_rounds
    where group_id = v_group_id;

    delete from public.matches
    where group_id = v_group_id;

    alter table public.matches enable trigger matches_block_delete_active;

    raise notice 'Cleared fixtures for honor group %', v_group_id;
  end if;

  raise notice 'Done. Regenerate fixtures for group %', v_group_id;
end;
$$;

select
  cmd.round,
  cmd.datetime,
  (cmd.datetime at time zone 'Europe/Brussels')::date as brussels_date,
  count(*) over (
    partition by (cmd.datetime at time zone 'Europe/Brussels')::date
  ) as rounds_on_day
from public.competition_match_dates cmd
join public.divisions d on d.id = cmd.division_id
join public.leagues l on l.id = d.league_id
join public.seasons s on s.id = l.season_id
where s.is_active = true
  and d.name = 'Honor Division'
  and cmd.scope = 'national'
order by cmd.round;
