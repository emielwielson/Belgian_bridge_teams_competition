/**
 * Regenerate supabase/demo-data/flanders-2024-25-demo.sql from demo-flanders-data.ts
 * Usage: npx tsx scripts/generate-flanders-demo-sql.ts
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { FLANDERS_DEMO_GROUPS } from "../lib/competition/demo-flanders-data";
import { computeRoundCount } from "../lib/scheduling/round-robin-schedule";

const teamValues: string[] = [];
for (const g of FLANDERS_DEMO_GROUPS) {
  for (const t of g.teams) {
    teamValues.push(
      `    (${g.liga}, '${g.groupCode}', '${t.replace(/'/g, "''")}', ${computeRoundCount(g.teams.length, g.roundRobinCount)})`,
    );
  }
}

const groupSpecs = FLANDERS_DEMO_GROUPS.map(
  (g) =>
    `      ('Liga ${g.liga}', '${g.groupCode}', ${g.roundRobinCount}, ${computeRoundCount(g.teams.length, g.roundRobinCount)})`,
);

const sql = `-- Demo data: 2024–25 Flanders regional competition (wipe + reload).
-- Run in SQL Editor after migrations through 0013.
-- Schedules for 8-team groups: \`npm run demo:flanders\` from web/ (or Admin UI).

do $$
declare
  v_season_id uuid;
  v_league_id uuid;
  v_region_id uuid;
begin
  select id into v_season_id from public.seasons where is_active = true limit 1;
  if v_season_id is null then
    raise exception 'No active season — run seed.sql first';
  end if;

  select id into v_region_id from public.regions where code = 'flanders' limit 1;
  if v_region_id is null then
    raise exception 'Flanders region not found';
  end if;

  delete from public.rulings r
  where r.match_id in (
    select m.id
    from public.matches m
    join public.groups g on g.id = m.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'regional'
      and l.region_id = v_region_id
  );

  delete from public.matches m
  using public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where m.group_id = g.id
    and l.season_id = v_season_id
    and l.scope = 'regional'
    and l.region_id = v_region_id;

  delete from public.team_players tp
  where tp.team_id in (
    select t.id
    from public.teams t
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'regional'
      and l.region_id = v_region_id
  );

  update public.teams t
  set captain_id = null
  from public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where t.group_id = g.id
    and l.season_id = v_season_id
    and l.scope = 'regional'
    and l.region_id = v_region_id;

  delete from public.player_club_memberships pcm
  using public.players p
  where pcm.player_id = p.id
    and pcm.season_id = v_season_id
    and p.member_number like 'DEMO-F%';

  delete from public.players p
  where p.member_number like 'DEMO-F%';

  delete from public.penalties p
  where p.team_id in (
    select t.id
    from public.teams t
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'regional'
      and l.region_id = v_region_id
  );

  delete from public.warnings w
  where w.team_id in (
    select t.id
    from public.teams t
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'regional'
      and l.region_id = v_region_id
  );

  delete from public.teams t
  using public.groups g
  join public.divisions d on d.id = g.division_id
  join public.leagues l on l.id = d.league_id
  where t.group_id = g.id
    and l.season_id = v_season_id
    and l.scope = 'regional'
    and l.region_id = v_region_id;

  delete from public.competition_match_dates
  where season_id = v_season_id
    and scope = 'regional'
    and region_id = v_region_id;

  insert into public.leagues (season_id, scope, region_id, name)
  select v_season_id, 'regional', v_region_id, 'Flanders'
  where not exists (
    select 1 from public.leagues l
    where l.season_id = v_season_id
      and l.scope = 'regional'
      and l.region_id = v_region_id
  );

  update public.leagues
  set name = 'Flanders'
  where season_id = v_season_id
    and scope = 'regional'
    and region_id = v_region_id;

  select l.id into v_league_id
  from public.leagues l
  where l.season_id = v_season_id
    and l.scope = 'regional'
    and l.region_id = v_region_id
  limit 1;

  insert into public.divisions (league_id, division_level_id, name)
  select v_league_id, dl.id, spec.division_name
  from (
    values
      ('Liga 1', 'first'),
      ('Liga 2', 'second'),
      ('Liga 3', 'third')
  ) as spec(division_name, level_code)
  join public.division_levels dl on dl.code = spec.level_code
  where not exists (
    select 1 from public.divisions d
    where d.league_id = v_league_id and d.name = spec.division_name
  );

  insert into public.groups (division_id, name, max_matches_per_day_per_team, round_robin_count, round_count)
  select d.id, spec.group_code, null::int, spec.round_robin_count, spec.round_count
  from public.divisions d
  join (
    values
${groupSpecs.join(",\n")}
  ) as spec(division_name, group_code, round_robin_count, round_count)
  where d.league_id = v_league_id
    and d.name = spec.division_name
    and not exists (
      select 1 from public.groups g
      where g.division_id = d.id and g.name = spec.group_code
    );

  update public.groups g
  set
    round_robin_count = spec.round_robin_count,
    round_count = spec.round_count
  from public.divisions d
  join (
    values
${groupSpecs.join(",\n")}
  ) as spec(division_name, group_code, round_robin_count, round_count)
  where g.division_id = d.id
    and d.league_id = v_league_id
    and d.name = spec.division_name
    and g.name = spec.group_code;

  insert into public.competition_match_dates (season_id, scope, region_id, division_id, round, datetime)
  values
    (v_season_id, 'regional', v_region_id, null, 1,  ('2024-09-27 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 2,  ('2024-10-04 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 3,  ('2024-10-11 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 4,  ('2024-10-18 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 5,  ('2024-11-08 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 6,  ('2024-11-15 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 7,  ('2024-11-22 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 8,  ('2024-12-06 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 9,  ('2024-12-13 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 10, ('2025-01-17 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 11, ('2025-01-24 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 12, ('2025-01-31 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 13, ('2025-02-14 14:00'::timestamp at time zone 'Europe/Brussels')),
    (v_season_id, 'regional', v_region_id, null, 14, ('2025-02-28 14:00'::timestamp at time zone 'Europe/Brussels'));

  create temp table flanders_demo_teams (
    liga int not null,
    group_code text not null,
    team_name text not null,
    round_count int not null
  ) on commit drop;

  insert into flanders_demo_teams (liga, group_code, team_name, round_count)
  values
${teamValues.join(",\n")};

  insert into public.clubs (name, region_id)
  select distinct
    regexp_replace(fdt.team_name, '\\s+(\\d+|C\\d+|1C)$', ''),
    v_region_id
  from flanders_demo_teams fdt
  where not exists (
    select 1
    from public.clubs c
    where c.name = regexp_replace(fdt.team_name, '\\s+(\\d+|C\\d+|1C)$', '')
      and c.region_id = v_region_id
  );

  insert into public.teams (group_id, club_id, name)
  select g.id, c.id, fdt.team_name
  from flanders_demo_teams fdt
  join public.divisions d on d.league_id = v_league_id
    and d.name = 'Liga ' || fdt.liga::text
  join public.groups g on g.division_id = d.id and g.name = fdt.group_code
  join public.clubs c on c.region_id = v_region_id
    and c.name = regexp_replace(fdt.team_name, '\\s+(\\d+|C\\d+|1C)$', '');

  insert into public.players (name, member_number)
  select
    nc.club_name || ' Player ' || lpad(ps.player_num::text, 2, '0'),
    'DEMO-F' || lpad(nc.club_num::text, 3, '0') || '-P' || lpad(ps.player_num::text, 2, '0')
  from (
    select
      c.name as club_name,
      row_number() over (order by c.name) as club_num,
      count(t.id)::int as team_count
    from public.clubs c
    join public.teams t on t.club_id = c.id
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where c.region_id = v_region_id
      and l.season_id = v_season_id
      and l.scope = 'regional'
      and l.region_id = v_region_id
    group by c.id, c.name
  ) nc
  cross join lateral generate_series(1, nc.team_count * 4 + 3) as ps(player_num)
  where not exists (
    select 1
    from public.players p
    where p.member_number = 'DEMO-F' || lpad(nc.club_num::text, 3, '0') || '-P' || lpad(ps.player_num::text, 2, '0')
  );

  insert into public.player_club_memberships (player_id, club_id, season_id)
  select p.id, nc.club_id, v_season_id
  from (
    select
      c.id as club_id,
      c.name as club_name,
      row_number() over (order by c.name) as club_num,
      count(t.id)::int as team_count
    from public.clubs c
    join public.teams t on t.club_id = c.id
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where c.region_id = v_region_id
      and l.season_id = v_season_id
      and l.scope = 'regional'
      and l.region_id = v_region_id
    group by c.id, c.name
  ) nc
  cross join lateral generate_series(1, nc.team_count * 4 + 3) as ps(player_num)
  join public.players p on p.member_number =
    'DEMO-F' || lpad(nc.club_num::text, 3, '0') || '-P' || lpad(ps.player_num::text, 2, '0')
  where not exists (
    select 1
    from public.player_club_memberships pcm
    where pcm.player_id = p.id
      and pcm.club_id = nc.club_id
      and pcm.season_id = v_season_id
  );

  insert into public.team_players (team_id, player_id, season_id)
  select
    tr.team_id,
    p.id,
    v_season_id
  from (
    select
      t.id as team_id,
      t.club_id,
      row_number() over (
        partition by t.club_id
        order by d.name, g.name, t.name
      ) as team_idx,
      nc.club_num
    from public.teams t
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    join (
      select c.id as club_id, row_number() over (order by c.name) as club_num
      from public.clubs c
      where c.region_id = v_region_id
    ) nc on nc.club_id = t.club_id
    where l.season_id = v_season_id
      and l.scope = 'regional'
      and l.region_id = v_region_id
  ) tr
  cross join lateral generate_series(1, 4) as slot(n)
  join public.players p on p.member_number =
    'DEMO-F' || lpad(tr.club_num::text, 3, '0') || '-P' ||
    lpad(((tr.team_idx - 1) * 4 + slot.n)::text, 2, '0');

  update public.teams t
  set captain_id = p.id
  from (
    select
      t.id as team_id,
      row_number() over (
        partition by t.club_id
        order by d.name, g.name, t.name
      ) as team_idx,
      nc.club_num
    from public.teams t
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    join (
      select c.id as club_id, row_number() over (order by c.name) as club_num
      from public.clubs c
      where c.region_id = v_region_id
    ) nc on nc.club_id = t.club_id
    where l.season_id = v_season_id
      and l.scope = 'regional'
      and l.region_id = v_region_id
  ) tr
  join public.players p on p.member_number =
    'DEMO-F' || lpad(tr.club_num::text, 3, '0') || '-P' ||
    lpad(((tr.team_idx - 1) * 4 + 1)::text, 2, '0')
  where t.id = tr.team_id;

end $$;
`;

const outPath = resolve(
  process.cwd(),
  "../supabase/demo-data/flanders-2024-25-demo.sql",
);
writeFileSync(outPath, sql, "utf8");
console.log(`Wrote ${outPath} (${sql.length} bytes, ${teamValues.length} teams)`);
