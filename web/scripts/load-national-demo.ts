/**
 * Load 2024–25 national demo match dates, ensure structure, seed demo teams,
 * and generate RBBF schedules for all national groups (service role).
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

async function listNationalGroups(supabase: SupabaseClient, seasonId: string) {
  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "national")
    .eq("name", "National")
    .maybeSingle();
  if (!league) throw new Error("National league not found");

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
    const { count } = await supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id);
    if ((count ?? 0) >= 8) continue;

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

  const groups = await listNationalGroups(supabase, season.id);

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
      console.log(`  Skip ${group.name}: already has matches`);
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
