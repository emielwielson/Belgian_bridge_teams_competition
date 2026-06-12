/**
 * Reset and load 2024–25 Flanders regional demo: last season's divisions, groups,
 * teams, match dates (14:00), rosters, and RBBF schedules for 8-team groups.
 *
 * Usage (from web/):
 *   npm run demo:flanders
 *
 * Requires web/.env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  FLANDERS_DEMO_GROUPS,
  clubNameFromTeamName,
  flandersDivisionName,
  uniqueFlandersClubNames,
} from "../lib/competition/demo-flanders-data";
import {
  FLANDERS_14_ROUNDS,
  flandersSlotToBrusselsLocal,
  type FlandersDemoRoundSlot,
} from "../lib/competition/demo-flanders-match-dates";
import { ensureFlandersStructure } from "../lib/competition/ensure-flanders-structure";
import { parseBrusselsToUtc } from "../lib/time/brussels";
import { loadGroupScoringContext } from "../lib/competition/match-scoring-context";
import { generateGroupScheduleInDb } from "../lib/scheduling/generate-group-schedule-db";
import {
  scheduledBoardCount,
  vpBoardCountsForGroup,
} from "../lib/scoring/board-count-rules";
import { ensureVpTablesForGroup } from "../lib/scoring/standard-vp-bands";

const ROSTER_PLAYERS_PER_TEAM = 4;
const EXTRA_UNASSIGNED_PLAYERS_PER_CLUB = 3;

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

function flandersClubCode(index: number): string {
  return String(index).padStart(3, "0");
}

function flandersMemberNumber(clubIndex: number, playerNum: number): string {
  return `DEMO-F${flandersClubCode(clubIndex)}-P${String(playerNum).padStart(2, "0")}`;
}

async function getFlandersRegionId(supabase: SupabaseClient): Promise<string> {
  const { data: region, error } = await supabase
    .from("regions")
    .select("id")
    .eq("code", "flanders")
    .single();
  if (error || !region) throw new Error("Flanders region not found");
  return region.id;
}

async function upsertFlandersMatchDates(
  supabase: SupabaseClient,
  seasonId: string,
  regionId: string,
  rounds: FlandersDemoRoundSlot[],
) {
  const { error: deleteError } = await supabase
    .from("competition_match_dates")
    .delete()
    .eq("season_id", seasonId)
    .eq("scope", "regional")
    .eq("region_id", regionId)
    .is("division_id", null);
  if (deleteError) throw deleteError;

  const rows = rounds.map((slot) => ({
    season_id: seasonId,
    scope: "regional" as const,
    region_id: regionId,
    division_id: null,
    round: slot.round,
    datetime: parseBrusselsToUtc(flandersSlotToBrusselsLocal(slot)),
  }));

  const { error: insertError } = await supabase
    .from("competition_match_dates")
    .insert(rows);
  if (insertError) throw insertError;
}

type FlandersGroupRow = {
  id: string;
  name: string;
  label: string;
  divisionName: string;
};

async function listFlandersGroups(
  supabase: SupabaseClient,
  seasonId: string,
  options?: { required?: boolean },
): Promise<FlandersGroupRow[]> {
  const regionId = await getFlandersRegionId(supabase);

  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "regional")
    .eq("region_id", regionId)
    .maybeSingle();

  if (!league) {
    if (options?.required !== false) {
      throw new Error("Flanders regional league not found");
    }
    return [];
  }

  const { data: divisions, error: divError } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("league_id", league.id);
  if (divError) throw divError;
  const divisionById = new Map(divisions?.map((d) => [d.id, d.name]) ?? []);

  const divisionIds = divisions?.map((d) => d.id) ?? [];
  if (divisionIds.length === 0) return [];

  const { data: groups, error: groupError } = await supabase
    .from("groups")
    .select("id, name, division_id")
    .in("division_id", divisionIds)
    .order("name");
  if (groupError) throw groupError;

  return (groups ?? []).map((g) => {
    const divisionName = divisionById.get(g.division_id) ?? "";
    return {
      id: g.id,
      name: g.name,
      divisionName,
      label: `${divisionName} ${g.name}`,
    };
  });
}

async function resolveFlandersGroupId(
  supabase: SupabaseClient,
  seasonId: string,
  liga: 1 | 2 | 3,
  groupCode: string,
): Promise<string> {
  const groups = await listFlandersGroups(supabase, seasonId);
  const divisionName = flandersDivisionName(liga);
  const group = groups.find(
    (g) => g.divisionName === divisionName && g.name === groupCode,
  );
  if (!group) {
    throw new Error(`Group not found: ${divisionName} ${groupCode}`);
  }
  return group.id;
}

async function resetFlandersDemo(supabase: SupabaseClient, seasonId: string) {
  const regionId = await getFlandersRegionId(supabase);

  const { error: datesError } = await supabase
    .from("competition_match_dates")
    .delete()
    .eq("season_id", seasonId)
    .eq("scope", "regional")
    .eq("region_id", regionId);
  if (datesError) throw datesError;

  const groups = await listFlandersGroups(supabase, seasonId, {
    required: false,
  });
  if (groups.length === 0) return;

  const groupIds = groups.map((g) => g.id);

  const { error: deleteByesError } = await supabase
    .from("group_bye_rounds")
    .delete()
    .in("group_id", groupIds);
  if (deleteByesError) throw deleteByesError;

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

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .in("group_id", groupIds);
  if (teamsError) throw teamsError;
  const teamIds = teams?.map((t) => t.id) ?? [];

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

  await deleteFlandersDemoPlayers(supabase, seasonId);

  const { error: deleteTeamsError } = await supabase
    .from("teams")
    .delete()
    .in("group_id", groupIds);
  if (deleteTeamsError) throw deleteTeamsError;
}

async function deleteFlandersDemoPlayers(
  supabase: SupabaseClient,
  seasonId: string,
) {
  const { data: demoPlayers, error: findError } = await supabase
    .from("players")
    .select("id")
    .like("member_number", "DEMO-F%");
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

async function ensureFlandersClubMap(
  supabase: SupabaseClient,
  regionId: string,
): Promise<Map<string, string>> {
  const sortedNames = uniqueFlandersClubNames();
  const clubIdByName = new Map<string, string>();

  for (const name of sortedNames) {
    const { data: existing } = await supabase
      .from("clubs")
      .select("id")
      .eq("name", name)
      .eq("region_id", regionId)
      .maybeSingle();

    if (existing) {
      clubIdByName.set(name, existing.id);
      continue;
    }

    const { data: created, error } = await supabase
      .from("clubs")
      .insert({ name, region_id: regionId })
      .select("id")
      .single();
    if (error) throw error;
    clubIdByName.set(name, created.id);
  }

  return clubIdByName;
}

async function seedFlandersTeams(supabase: SupabaseClient, seasonId: string) {
  const regionId = await getFlandersRegionId(supabase);
  const clubIdByName = await ensureFlandersClubMap(supabase, regionId);

  for (const spec of FLANDERS_DEMO_GROUPS) {
    const groupId = await resolveFlandersGroupId(
      supabase,
      seasonId,
      spec.liga,
      spec.groupCode,
    );

    for (const teamName of spec.teams) {
      const clubName = clubNameFromTeamName(teamName);
      const clubId = clubIdByName.get(clubName);
      if (!clubId) {
        throw new Error(`Missing club for team ${teamName}`);
      }

      const { error } = await supabase.from("teams").insert({
        group_id: groupId,
        club_id: clubId,
        name: teamName,
      });
      if (error) throw error;
    }
  }
}

async function seedFlandersPlayers(supabase: SupabaseClient, seasonId: string) {
  const regionId = await getFlandersRegionId(supabase);
  const sortedClubNames = uniqueFlandersClubNames();
  const clubIndexByName = new Map(
    sortedClubNames.map((name, index) => [name, index + 1]),
  );

  const { data: clubs, error: clubsError } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("region_id", regionId)
    .in("name", sortedClubNames);
  if (clubsError) throw clubsError;
  if (!clubs?.length) return;

  const groups = await listFlandersGroups(supabase, seasonId);
  if (groups.length === 0) return;

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, club_id, group_id, name")
    .in(
      "group_id",
      groups.map((g) => g.id),
    );
  if (teamsError) throw teamsError;

  const groupLabel = new Map(groups.map((g) => [g.id, g.label]));
  const teamsByClub = new Map<string, NonNullable<typeof teams>>();
  for (const team of teams ?? []) {
    const list = teamsByClub.get(team.club_id) ?? [];
    list.push(team);
    teamsByClub.set(team.club_id, list);
  }

  const playerRows: { name: string; member_number: string }[] = [];
  for (const club of clubs) {
    const clubIndex = clubIndexByName.get(club.name);
    if (!clubIndex) continue;
    const teamCount = teamsByClub.get(club.id)?.length ?? 0;
    const playersNeeded =
      teamCount * ROSTER_PLAYERS_PER_TEAM + EXTRA_UNASSIGNED_PLAYERS_PER_CLUB;
    for (let p = 1; p <= playersNeeded; p++) {
      playerRows.push({
        name: `${club.name} Player ${String(p).padStart(2, "0")}`,
        member_number: flandersMemberNumber(clubIndex, p),
      });
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("players")
    .select("member_number")
    .like("member_number", "DEMO-F%");
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
    .like("member_number", "DEMO-F%");
  if (playersError) throw playersError;

  const playerByMember = new Map(
    (allPlayers ?? []).map((p) => [p.member_number, p.id]),
  );

  for (const club of clubs) {
    const clubIndex = clubIndexByName.get(club.name);
    if (!clubIndex) continue;
    const clubTeams = teamsByClub.get(club.id) ?? [];
    const playersNeeded =
      clubTeams.length * ROSTER_PLAYERS_PER_TEAM +
      EXTRA_UNASSIGNED_PLAYERS_PER_CLUB;

    const { data: currentMemberships } = await supabase
      .from("player_club_memberships")
      .select("player_id")
      .eq("club_id", club.id)
      .eq("season_id", seasonId);

    const memberIds = new Set(currentMemberships?.map((m) => m.player_id) ?? []);
    const membershipInserts = [];
    for (let p = 1; p <= playersNeeded; p++) {
      const memberNumber = flandersMemberNumber(clubIndex, p);
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
    const clubIndex = clubIndexByName.get(club.name);
    if (!clubIndex) continue;
    const clubTeams = teamsByClub.get(club.id) ?? [];
    clubTeams.sort((a, b) =>
      (groupLabel.get(a.group_id) ?? "").localeCompare(
        groupLabel.get(b.group_id) ?? "",
      ),
    );

    const rosterInserts = clubTeams.flatMap((team, teamIdx) =>
      [1, 2, 3, 4].map((slot) => {
        const playerNum = teamIdx * ROSTER_PLAYERS_PER_TEAM + slot;
        const memberNumber = flandersMemberNumber(clubIndex, playerNum);
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
      const captainMember = flandersMemberNumber(
        clubIndex,
        teamIdx * ROSTER_PLAYERS_PER_TEAM + 1,
      );
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

  const regionId = await getFlandersRegionId(supabase);

  console.log(`Season: ${season.name}`);
  await ensureFlandersStructure(supabase, season.id);

  console.log("Resetting Flanders demo data…");
  await resetFlandersDemo(supabase, season.id);

  console.log("Loading match dates (14:00)…");
  await upsertFlandersMatchDates(
    supabase,
    season.id,
    regionId,
    FLANDERS_14_ROUNDS,
  );

  console.log("Seeding clubs and teams…");
  await seedFlandersTeams(supabase, season.id);

  console.log("Seeding demo players (4 per team + 3 unassigned per club)…");
  await seedFlandersPlayers(supabase, season.id);

  const groups = await listFlandersGroups(supabase, season.id, {
    required: true,
  });

  console.log("Ensuring VP tables…");
  for (const group of groups) {
    const scoringContext = await loadGroupScoringContext(supabase, group.id);
    await ensureVpTablesForGroup(
      supabase,
      group.id,
      vpBoardCountsForGroup(scoringContext),
    );
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

    if ((teamCount ?? 0) < 2) {
      console.warn(`  Skip ${group.label}: need at least 2 teams`);
      continue;
    }
    if ((matchCount ?? 0) > 0) {
      console.warn(`  Skip ${group.label}: unexpected existing matches`);
      continue;
    }

    try {
      const scoringContext = await loadGroupScoringContext(supabase, group.id);
      const boardCount = scheduledBoardCount(scoringContext);
      const result = await generateGroupScheduleInDb(
        supabase,
        group.id,
        boardCount,
      );
      const byeNote =
        result.byesCreated > 0 ? `, ${result.byesCreated} bye rounds` : "";
      console.log(
        `  ${group.label}: ${result.matchesCreated} matches${byeNote}`,
      );
    } catch (err) {
      console.error(
        `  ${group.label}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
