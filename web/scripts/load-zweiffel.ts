/**
 * Load Zweiffel calendar (2026–27 fixtures) into the **active** season —
 * same season as National / Flanders / Wallonia.
 * Inserts fixtures directly — does not use generateGroupScheduleInDb.
 *
 * Usage (from web/):
 *   npm run load:zweiffel
 *
 * Requires web/.env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
 * Clubs must already exist with the federation club_number values listed in the data module.
 * Requires migration 0076 (zweiffel region + competition_kind).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ensureZweiffelStructure } from "../lib/competition/ensure-zweiffel-structure";
import {
  isByeLabel,
  uniqueZweiffelClubNumbers,
  ZWEIFFEL_DIVISION_SPECS,
  ZWEIFFEL_TEAM_CLUB_NUMBERS,
  zweiffelSlotToBrusselsLocal,
  type ZweiffelDivisionSpec,
  type ZweiffelRoundSlot,
} from "../lib/competition/zweiffel-data";
import { loadGroupScoringContext } from "../lib/competition/match-scoring-context";
import { REGION_CODES } from "../lib/competition/scopes";
import { parseBrusselsToUtc } from "../lib/time/brussels";
import {
  scheduledBoardCount,
  vpBoardCountsForGroup,
} from "../lib/scoring/board-count-rules";
import { ensureVpTablesForGroup } from "../lib/scoring/standard-vp-bands";

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

async function getZweiffelRegionId(supabase: SupabaseClient): Promise<string> {
  const { data: region, error } = await supabase
    .from("regions")
    .select("id")
    .eq("code", REGION_CODES.ZWEIFFEL)
    .single();
  if (error || !region) throw new Error("Zweiffel region not found");
  return region.id;
}

async function resolveSeasonId(supabase: SupabaseClient): Promise<{
  id: string;
  name: string;
}> {
  const { data: season, error } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!season) {
    throw new Error("No active season configured");
  }
  return season;
}

type DivisionGroupRow = {
  divisionName: string;
  groupId: string;
};

async function listZweiffelGroups(
  supabase: SupabaseClient,
  seasonId: string,
  options?: { required?: boolean },
): Promise<DivisionGroupRow[]> {
  const regionId = await getZweiffelRegionId(supabase);

  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "regional")
    .eq("region_id", regionId)
    .maybeSingle();

  if (!league) {
    if (options?.required !== false) {
      throw new Error("Zweiffel regional league not found");
    }
    return [];
  }

  const { data: divisions, error: divError } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("league_id", league.id);
  if (divError) throw divError;

  const rows: DivisionGroupRow[] = [];
  for (const div of divisions ?? []) {
    const { data: groups, error: groupError } = await supabase
      .from("groups")
      .select("id, name")
      .eq("division_id", div.id);
    if (groupError) throw groupError;
    for (const g of groups ?? []) {
      rows.push({ divisionName: div.name, groupId: g.id });
    }
  }
  return rows;
}

/** Evening Honneur calendar (14 rounds @ 20:00) for regional readiness. */
function eveningCalendarSlots(): ZweiffelRoundSlot[] {
  const honneur = ZWEIFFEL_DIVISION_SPECS.find((s) => s.name === "Honneur");
  if (!honneur) throw new Error("Honneur division missing from data");
  return honneur.rounds;
}

async function upsertZweiffelMatchDates(
  supabase: SupabaseClient,
  seasonId: string,
  regionId: string,
  rounds: ZweiffelRoundSlot[],
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
    datetime: parseBrusselsToUtc(zweiffelSlotToBrusselsLocal(slot)),
  }));

  const { error: insertError } = await supabase
    .from("competition_match_dates")
    .insert(rows);
  if (insertError) throw insertError;
}

async function resetZweiffel(
  supabase: SupabaseClient,
  seasonId: string,
) {
  const regionId = await getZweiffelRegionId(supabase);

  const { error: datesError } = await supabase
    .from("competition_match_dates")
    .delete()
    .eq("season_id", seasonId)
    .eq("scope", "regional")
    .eq("region_id", regionId);
  if (datesError) throw datesError;

  const groups = await listZweiffelGroups(supabase, seasonId, {
    required: false,
  });
  if (groups.length === 0) return;

  const groupIds = groups.map((g) => g.groupId);

  const { error: deleteByesError } = await supabase
    .from("group_bye_rounds")
    .delete()
    .in("group_id", groupIds);
  if (deleteByesError) throw deleteByesError;

  const { error: skipError } = await supabase
    .from("group_skipped_match_rounds")
    .delete()
    .in("group_id", groupIds);
  if (skipError) throw skipError;

  const { error: slotsError } = await supabase
    .from("group_schedule_slots")
    .delete()
    .in("group_id", groupIds);
  if (slotsError) throw slotsError;

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

  const { error: deleteTeamsError } = await supabase
    .from("teams")
    .delete()
    .in("group_id", groupIds);
  if (deleteTeamsError) throw deleteTeamsError;
}

async function resolveClubIdByNumber(
  supabase: SupabaseClient,
  clubNumber: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("clubs")
    .select("id, club_number")
    .eq("club_number", clubNumber)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(`Club not found for club_number ${clubNumber}`);
  }
  return data.id;
}

async function ensureClubMapByNumber(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const clubIdByNumber = new Map<string, string>();
  for (const clubNumber of uniqueZweiffelClubNumbers()) {
    const id = await resolveClubIdByNumber(supabase, clubNumber);
    clubIdByNumber.set(clubNumber, id);
  }
  return clubIdByNumber;
}

async function resolveGroupIdForDivision(
  supabase: SupabaseClient,
  seasonId: string,
  divisionName: string,
): Promise<string> {
  const groups = await listZweiffelGroups(supabase, seasonId);
  const row = groups.find((g) => g.divisionName === divisionName);
  if (!row) throw new Error(`Group not found for division ${divisionName}`);
  return row.groupId;
}

async function seedZweiffelTeams(
  supabase: SupabaseClient,
  seasonId: string,
): Promise<Map<string, Map<string, string>>> {
  const clubIdByNumber = await ensureClubMapByNumber(supabase);
  const teamIdsByDivision = new Map<string, Map<string, string>>();

  for (const spec of ZWEIFFEL_DIVISION_SPECS) {
    const groupId = await resolveGroupIdForDivision(
      supabase,
      seasonId,
      spec.name,
    );
    const teamIdByName = new Map<string, string>();

    for (const teamName of spec.teams) {
      const clubNumber = ZWEIFFEL_TEAM_CLUB_NUMBERS[teamName];
      if (!clubNumber) {
        throw new Error(`Missing club_number mapping for team ${teamName}`);
      }
      const clubId = clubIdByNumber.get(clubNumber);
      if (!clubId) {
        throw new Error(`Missing club id for club_number ${clubNumber}`);
      }

      const { data: created, error } = await supabase
        .from("teams")
        .insert({
          group_id: groupId,
          club_id: clubId,
          name: teamName,
        })
        .select("id")
        .single();
      if (error) throw error;
      teamIdByName.set(teamName, created.id);
    }

    teamIdsByDivision.set(spec.name, teamIdByName);
  }

  return teamIdsByDivision;
}

function datetimeForDivisionRound(
  spec: ZweiffelDivisionSpec,
  round: number,
): string {
  const slot = spec.rounds.find((r) => r.round === round);
  if (!slot) {
    throw new Error(`${spec.name}: no match date for round ${round}`);
  }
  return parseBrusselsToUtc(zweiffelSlotToBrusselsLocal(slot));
}

async function insertFixturesForDivision(
  supabase: SupabaseClient,
  groupId: string,
  spec: ZweiffelDivisionSpec,
  teamIdByName: Map<string, string>,
  boardCount: number,
) {
  const matchRows: {
    group_id: string;
    round: number;
    datetime: string;
    home_team_id: string;
    away_team_id: string;
    hosting_team_id: string;
    board_count: number;
  }[] = [];
  const byeRows: {
    group_id: string;
    round: number;
    team_id: string;
    vp: number;
  }[] = [];

  for (const fixture of spec.fixtures) {
    const homeBye = isByeLabel(fixture.home);
    const awayBye = isByeLabel(fixture.away);

    if (homeBye && awayBye) {
      throw new Error(
        `${spec.name} round ${fixture.round}: both sides are Bye`,
      );
    }

    if (homeBye || awayBye) {
      const teamName = homeBye ? fixture.away : fixture.home;
      const teamId = teamIdByName.get(teamName);
      if (!teamId) {
        throw new Error(
          `${spec.name}: unknown bye team "${teamName}" in round ${fixture.round}`,
        );
      }
      byeRows.push({
        group_id: groupId,
        round: fixture.round,
        team_id: teamId,
        vp: 12,
      });
      continue;
    }

    const homeId = teamIdByName.get(fixture.home);
    const awayId = teamIdByName.get(fixture.away);
    if (!homeId || !awayId) {
      throw new Error(
        `${spec.name} round ${fixture.round}: unknown team (${fixture.home} vs ${fixture.away})`,
      );
    }

    matchRows.push({
      group_id: groupId,
      round: fixture.round,
      datetime: datetimeForDivisionRound(spec, fixture.round),
      home_team_id: homeId,
      away_team_id: awayId,
      hosting_team_id: homeId,
      board_count: boardCount,
    });
  }

  if (matchRows.length > 0) {
    const { error } = await supabase.from("matches").insert(matchRows);
    if (error) throw error;
  }

  if (byeRows.length > 0) {
    const { error } = await supabase.from("group_bye_rounds").insert(byeRows);
    if (error) throw error;
  }

  return { matchesCreated: matchRows.length, byesCreated: byeRows.length };
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

  const season = await resolveSeasonId(supabase);
  const regionId = await getZweiffelRegionId(supabase);

  console.log(`Active season: ${season.name}`);
  await ensureZweiffelStructure(supabase, season.id);

  console.log("Resetting Zweiffel data…");
  await resetZweiffel(supabase, season.id);

  console.log("Loading regional match dates (Honneur 20:00 calendar)…");
  await upsertZweiffelMatchDates(
    supabase,
    season.id,
    regionId,
    eveningCalendarSlots(),
  );

  console.log("Seeding teams (clubs by club_number)…");
  const teamIdsByDivision = await seedZweiffelTeams(supabase, season.id);

  console.log("Ensuring VP tables and inserting Excel fixtures…");
  for (const spec of ZWEIFFEL_DIVISION_SPECS) {
    const groupId = await resolveGroupIdForDivision(
      supabase,
      season.id,
      spec.name,
    );
    const teamIdByName = teamIdsByDivision.get(spec.name);
    if (!teamIdByName) {
      throw new Error(`No teams seeded for ${spec.name}`);
    }

    const scoringContext = await loadGroupScoringContext(supabase, groupId);
    await ensureVpTablesForGroup(
      supabase,
      groupId,
      vpBoardCountsForGroup(scoringContext),
    );
    const boardCount = scheduledBoardCount(scoringContext);
    const result = await insertFixturesForDivision(
      supabase,
      groupId,
      spec,
      teamIdByName,
      boardCount,
    );
    const byeNote =
      result.byesCreated > 0 ? `, ${result.byesCreated} bye rounds` : "";
    console.log(
      `  ${spec.name}: ${result.matchesCreated} matches @ ${boardCount} boards${byeNote}`,
    );
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
