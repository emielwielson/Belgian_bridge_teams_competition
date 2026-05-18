/**
 * Regenerate supabase/demo-data/national-2024-25-demo.sql team section from demo-national-data.ts
 * Usage: npx tsx scripts/generate-national-demo-sql.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NATIONAL_DEMO_DIVISIONS } from "../lib/competition/demo-national-data";

const teamValues: string[] = [];
for (const division of NATIONAL_DEMO_DIVISIONS) {
  for (const team of division.teams) {
    teamValues.push(
      `    ('${division.divisionName.replace(/'/g, "''")}', '${team.replace(/'/g, "''")}')`,
    );
  }
}

const teamsBlock = `  create temp table national_demo_teams (
    division_name text not null,
    team_name text not null
  ) on commit drop;

  insert into national_demo_teams (division_name, team_name)
  values
${teamValues.join(",\n")};

  insert into public.clubs (name, region_id)
  select distinct
    regexp_replace(ndt.team_name, '\\s+\\d{3}$', ''),
    v_region_id
  from national_demo_teams ndt
  where not exists (
    select 1
    from public.clubs c
    where c.name = regexp_replace(ndt.team_name, '\\s+\\d{3}$', '')
      and c.region_id = v_region_id
  );

  insert into public.teams (group_id, club_id, name)
  select g.id, c.id, ndt.team_name
  from national_demo_teams ndt
  join public.divisions d on d.league_id = v_league_id
    and d.name = ndt.division_name
  join public.groups g on g.division_id = d.id and g.name = d.name
  join public.clubs c on c.region_id = v_region_id
    and c.name = regexp_replace(ndt.team_name, '\\s+\\d{3}$', '');

  insert into public.players (name, member_number)
  select
    nc.club_name || ' Player ' || lpad(ps.player_num::text, 2, '0'),
    'DEMO-N' || lpad(nc.club_num::text, 3, '0') || '-P' || lpad(ps.player_num::text, 2, '0')
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
    where l.season_id = v_season_id
      and l.scope = 'national'
    group by c.id, c.name
  ) nc
  cross join lateral generate_series(1, nc.team_count * 4 + 3) as ps(player_num)
  where not exists (
    select 1
    from public.players p
    where p.member_number = 'DEMO-N' || lpad(nc.club_num::text, 3, '0') || '-P' || lpad(ps.player_num::text, 2, '0')
  );

  insert into public.player_club_memberships (player_id, club_id, season_id)
  select p.id, nc.club_id, v_season_id
  from (
    select
      c.id as club_id,
      row_number() over (order by c.name) as club_num,
      count(t.id)::int as team_count
    from public.clubs c
    join public.teams t on t.club_id = c.id
    join public.groups g on g.id = t.group_id
    join public.divisions d on d.id = g.division_id
    join public.leagues l on l.id = d.league_id
    where l.season_id = v_season_id
      and l.scope = 'national'
    group by c.id, c.name
  ) nc
  cross join lateral generate_series(1, nc.team_count * 4 + 3) as ps(player_num)
  join public.players p on p.member_number =
    'DEMO-N' || lpad(nc.club_num::text, 3, '0') || '-P' || lpad(ps.player_num::text, 2, '0')
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
        order by d.name, t.name
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
      and l.scope = 'national'
  ) tr
  cross join lateral generate_series(1, 4) as slot(n)
  join public.players p on p.member_number =
    'DEMO-N' || lpad(tr.club_num::text, 3, '0') || '-P' ||
    lpad(((tr.team_idx - 1) * 4 + slot.n)::text, 2, '0');

  update public.teams t
  set captain_id = p.id
  from (
    select
      t.id as team_id,
      row_number() over (
        partition by t.club_id
        order by d.name, t.name
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
      and l.scope = 'national'
  ) tr
  join public.players p on p.member_number =
    'DEMO-N' || lpad(tr.club_num::text, 3, '0') || '-P' ||
    lpad(((tr.team_idx - 1) * 4 + 1)::text, 2, '0')
  where t.id = tr.team_id;
`;

const sqlPath = resolve(
  process.cwd(),
  "../supabase/demo-data/national-2024-25-demo.sql",
);
let sql = readFileSync(sqlPath, "utf8");

const startMarker = "  -- Clubs and teams from last season (see demo-national-data.ts)";
const endMarker = "\nend $$;\n\n-- Standard VP tables";

const startIdx = sql.indexOf(startMarker);
const endIdx = sql.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  throw new Error("Could not find replacement markers in national SQL file");
}

const newSection = `${startMarker}
  select id into v_region_id from public.regions where code = 'flanders' limit 1;

${teamsBlock}
`;

sql = sql.slice(0, startIdx) + newSection + sql.slice(endIdx);

writeFileSync(sqlPath, sql, "utf8");
console.log(`Updated ${sqlPath} (${teamValues.length} teams)`);
