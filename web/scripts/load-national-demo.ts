/**
 * Reset and load 2024–25 national demo: wipes national matches/teams/dates for the
 * active season, ensures structure, reloads match dates and demo teams, and generates
 * RBBF schedules for all national groups (service role).
 *
 * Usage (from web/):
 *   npm run demo:national
 *
 * Requires web/.env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_DEFAULT_ROUNDS,
  DEMO_FIRST_ROUNDS,
  DEMO_HONOR_ROUNDS,
  demoSlotToBrusselsLocal,
  type DemoRoundSlot,
} from "../lib/competition/demo-national-match-dates";
import {
  ensureNationalStructure,
  resolveNationalScheduleDivisionId,
} from "../lib/competition/ensure-national-structure";
import { parseBrusselsToUtc } from "../lib/time/brussels";
import { generateGroupScheduleInDb } from "../lib/scheduling/generate-group-schedule-db";
import { ensureStandardVpTable } from "../lib/scoring/standard-vp-bands";

function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function upsertMatchDates(
  supabase: SupabaseClient,
  seasonId: string,
  divisionId: string | null,
  rounds: DemoRoundSlot[],
) {
  let deleteQuery = supabase
    .from("competition_match_dates")
    .delete()
    .eq("season_id", seasonId)
    .eq("scope", "national")
    .is("region_id", null);

  deleteQuery =
    divisionId === null
      ? deleteQuery.is("division_id", null)
      : deleteQuery.eq("division_id", divisionId);

  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  const rows = rounds.map((slot) => ({
    season_id: seasonId,
    scope: "national" as const,
    region_id: null,
    division_id: divisionId,
    round: slot.round,
    datetime: parseBrusselsToUtc(demoSlotToBrusselsLocal(slot)),
  }));

  const { error: insertError } = await supabase
    .from("competition_match_dates")
    .insert(rows);
  if (insertError) throw insertError;
}

async function resetNationalDemo(supabase: SupabaseClient, seasonId: string) {
  const { error: datesError } = await supabase
    .from("competition_match_dates")
    .delete()
    .eq("season_id", seasonId)
    .eq("scope", "national")
    .is("region_id", null);
  if (datesError) throw datesError;

  const groups = await listNationalGroups(supabase, seasonId, {
    required: false,
  });
  if (groups.length === 0) return;

  const groupIds = groups.map((g) => g.id);

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .in("group_id", groupIds);
  if (teamsError) throw teamsError;
  const teamIds = teams?.map((t) => t.id) ?? [];

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id")
    .in("group_id", groupIds);
  if (matchesError) throw matchesError;
  const matchIds = matches?.map((m) => m.id) ?? [];

  if (matchIds.length > 0) {
    const { error: rulingsError } = await supabase
      .from("rulings")
      .delete()
      .in("match_id", matchIds);
    if (rulingsError) throw rulingsError;

    const { error: deleteMatchesError } = await supabase
      .from("matches")
      .delete()
      .in("group_id", groupIds);
    if (deleteMatchesError) throw deleteMatchesError;
  }

  if (teamIds.length > 0) {
    const { error: rosterError } = await supabase
      .from("team_players")
      .delete()
      .in("team_id", teamIds);
    if (rosterError) throw rosterError;

    const { error: captainError } = await supabase
      .from("teams")
      .update({ captain_id: null })
      .in("id", teamIds);
    if (captainError) throw captainError;

    const { error: penaltiesError } = await supabase
      .from("penalties")
      .delete()
      .in("team_id", teamIds);
    if (penaltiesError) throw penaltiesError;

    const { error: warningsError } = await supabase
      .from("warnings")
      .delete()
      .in("team_id", teamIds);
    if (warningsError) throw warningsError;
  }

  await deleteDemoPlayers(supabase, seasonId);

  const { error: deleteTeamsError } = await supabase
    .from("teams")
    .delete()
    .in("group_id", groupIds);
  if (deleteTeamsError) throw deleteTeamsError;
}

function demoClubNumber(clubName: string): number {
  const match = /^Demo Club (\d+)$/.exec(clubName);
  if (!match) throw new Error(`Invalid demo club name: ${clubName}`);
  return Number(match[1]);
}

async function deleteDemoPlayers(
  supabase: SupabaseClient,
  seasonId: string,
) {
  const { data: demoPlayers, error: findError } = await supabase
    .from("players")
    .select("id")
    .like("member_number", "DEMO-C%");
  if (findError) throw findError;

  const playerIds = demoPlayers?.map((p) => p.id) ?? [];
  if (playerIds.length === 0) return;

  const { error: membershipError } = await supabase
    .from("player_club_memberships")
    .delete()
    .eq("season_id", seasonId)
    .in("player_id", playerIds);
  if (membershipError) throw membershipError;

  const { error: playerError } = await supabase
    .from("players")
    .delete()
    .in("id", playerIds);
  if (playerError) throw playerError;
}

async function seedDemoPlayers(supabase: SupabaseClient, seasonId: string) {
  const { data: clubs, error: clubsError } = await supabase
    .from("clubs")
    .select("id, name")
    .like("name", "Demo Club %")
    .order("name")
    .limit(8);
  if (clubsError) throw clubsError;
  if (!clubs?.length) return;

  const groups = await listNationalGroups(supabase, seasonId);
  if (groups.length === 0) return;

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, club_id, group_id")
    .in(
      "group_id",
      groups.map((g) => g.id),
    )
    .in(
      "club_id",
      clubs.map((c) => c.id),
    );
  if (teamsError) throw teamsError;

  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const teamsByClub = new Map<string, NonNullable<typeof teams>>();
  for (const team of teams ?? []) {
    const list = teamsByClub.get(team.club_id) ?? [];
    list.push(team);
    teamsByClub.set(team.club_id, list);
  }

  const playerRows: { name: string; member_number: string }[] = [];
  for (const club of clubs) {
    const n = demoClubNumber(club.name);
    const teamCount = teamsByClub.get(club.id)?.length ?? 0;
    const playersNeeded = teamCount * 4;
    for (let p = 1; p <= playersNeeded; p++) {
      playerRows.push({
        name: `Demo Club ${n} Player ${String(p).padStart(2, "0")}`,
        member_number: `DEMO-C${n}-P${String(p).padStart(2, "0")}`,
      });
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("players")
    .select("member_number")
    .like("member_number", "DEMO-C%");
  if (existingError) throw existingError;

  const existingSet = new Set(existing?.map((p) => p.member_number) ?? []);
  const missing = playerRows.filter((p) => !existingSet.has(p.member_number));
  if (missing.length > 0) {
    const { error: insertError } = await supabase.from("players").insert(missing);
    if (insertError) throw insertError;
  }

  const { data: allPlayers, error: playersError } = await supabase
    .from("players")
    .select("id, member_number")
    .like("member_number", "DEMO-C%");
  if (playersError) throw playersError;

  const playerByMember = new Map(
    (allPlayers ?? []).map((p) => [p.member_number, p.id]),
  );

  for (const club of clubs) {
    const n = demoClubNumber(club.name);
    const playersNeeded = (teamsByClub.get(club.id)?.length ?? 0) * 4;
    const { data: currentMemberships } = await supabase
      .from("player_club_memberships")
      .select("player_id")
      .eq("club_id", club.id)
      .eq("season_id", seasonId);

    const memberIds = new Set(currentMemberships?.map((m) => m.player_id) ?? []);
    const membershipInserts = [];
    for (let p = 1; p <= playersNeeded; p++) {
      const memberNumber = `DEMO-C${n}-P${String(p).padStart(2, "0")}`;
      const playerId = playerByMember.get(memberNumber);
      if (!playerId || memberIds.has(playerId)) continue;
      membershipInserts.push({
        player_id: playerId,
        club_id: club.id,
        season_id: seasonId,
      });
    }
    if (membershipInserts.length > 0) {
      const { error } = await supabase
        .from("player_club_memberships")
        .insert(membershipInserts);
      if (error) throw error;
    }
  }

  for (const club of clubs) {
    const clubTeams = teamsByClub.get(club.id) ?? [];
    clubTeams.sort((a, b) =>
      (groupName.get(a.group_id) ?? "").localeCompare(
        groupName.get(b.group_id) ?? "",
      ),
    );

    const n = demoClubNumber(club.name);
    const rosterInserts = clubTeams.flatMap((team, teamIdx) =>
      [1, 2, 3, 4].map((slot) => {
        const playerNum = teamIdx * 4 + slot;
        const memberNumber = `DEMO-C${n}-P${String(playerNum).padStart(2, "0")}`;
        const playerId = playerByMember.get(memberNumber);
        if (!playerId) {
          throw new Error(`Missing demo player ${memberNumber}`);
        }
        return {
          team_id: team.id,
          player_id: playerId,
          season_id: seasonId,
        };
      }),
    );

    if (rosterInserts.length > 0) {
      const { error: rosterError } = await supabase
        .from("team_players")
        .insert(rosterInserts);
      if (rosterError) throw rosterError;
    }

    for (let teamIdx = 0; teamIdx < clubTeams.length; teamIdx++) {
      const team = clubTeams[teamIdx];
      const captainMember = `DEMO-C${n}-P${String(teamIdx * 4 + 1).padStart(2, "0")}`;
      const captainId = playerByMember.get(captainMember);
      if (!captainId) continue;
      const { error: capError } = await supabase
        .from("teams")
        .update({ captain_id: captainId })
        .eq("id", team.id);
      if (capError) throw capError;
    }
  }
}

async function listNationalGroups(
  supabase: SupabaseClient,
  seasonId: string,
  options?: { required?: boolean },
) {
  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "national")
    .maybeSingle();
  if (!league) {
    if (options?.required !== false) {
      throw new Error("National league not found");
    }
    return [];
  }

  const { data: divisions, error: divError } = await supabase
    .from("divisions")
    .select("id")
    .eq("league_id", league.id);
  if (divError) throw divError;
  const divisionIds = divisions?.map((d) => d.id) ?? [];

  const { data: groups, error: groupError } = await supabase
    .from("groups")
    .select("id, name")
    .in("division_id", divisionIds)
    .order("name");
  if (groupError) throw groupError;
  return groups ?? [];
}

async function seedDemoTeams(supabase: SupabaseClient, seasonId: string) {
  const { data: region } = await supabase
    .from("regions")
    .select("id")
    .eq("code", "flanders")
    .single();
  if (!region) throw new Error("Flanders region not found");

  for (let i = 1; i <= 8; i++) {
    const name = `Demo Club ${i}`;
    const { data: existing } = await supabase
      .from("clubs")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase
        .from("clubs")
        .insert({ name, region_id: region.id });
      if (error) throw error;
    }
  }

  const { data: clubs } = await supabase
    .from("clubs")
    .select("id, name")
    .like("name", "Demo Club %")
    .order("name")
    .limit(8);
  if (!clubs || clubs.length < 8) {
    throw new Error("Expected 8 demo clubs");
  }

  const groups = await listNationalGroups(supabase, seasonId);

  for (const group of groups) {
    for (const club of clubs) {
      const { error } = await supabase.from("teams").insert({
        group_id: group.id,
        club_id: club.id,
        name: `${club.name} — ${group.name}`,
      });
      if (error) throw error;
    }
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
    );
    process.exit(1);
  }

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
  });

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("is_active", true)
    .single();
  if (seasonError || !season) {
    throw seasonError ?? new Error("No active season");
  }

  console.log(`Season: ${season.name}`);
  await ensureNationalStructure(supabase, season.id);

  console.log("Resetting national demo data…");
  await resetNationalDemo(supabase, season.id);

  const honorDivisionId = await resolveNationalScheduleDivisionId(
    supabase,
    season.id,
    "honor",
  );
  const firstDivisionId = await resolveNationalScheduleDivisionId(
    supabase,
    season.id,
    "first",
  );
  if (!honorDivisionId || !firstDivisionId) {
    throw new Error("Honor or 1st Division not found");
  }

  console.log("Loading match dates…");
  await upsertMatchDates(supabase, season.id, honorDivisionId, DEMO_HONOR_ROUNDS);
  await upsertMatchDates(supabase, season.id, firstDivisionId, DEMO_FIRST_ROUNDS);
  await upsertMatchDates(supabase, season.id, null, DEMO_DEFAULT_ROUNDS);

  console.log("Seeding demo teams…");
  await seedDemoTeams(supabase, season.id);

  console.log("Seeding demo players (4 per team)…");
  await seedDemoPlayers(supabase, season.id);

  const groups = await listNationalGroups(supabase, season.id, {
    required: true,
  });

  console.log("Ensuring VP tables (24 boards)…");
  for (const group of groups) {
    await ensureStandardVpTable(supabase, group.id);
  }

  console.log("Generating schedules…");
  for (const group of groups) {
    const { count: teamCount } = await supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id);

    const { count: matchCount } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id);

    if ((teamCount ?? 0) !== 8) {
      console.warn(`  Skip ${group.name}: need 8 teams (has ${teamCount ?? 0})`);
      continue;
    }
    if ((matchCount ?? 0) > 0) {
      console.warn(`  Skip ${group.name}: unexpected existing matches`);
      continue;
    }

    try {
      const result = await generateGroupScheduleInDb(supabase, group.id);
      console.log(`  ${group.name}: ${result.matchesCreated} matches`);
    } catch (err) {
      console.error(
        `  ${group.name}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
