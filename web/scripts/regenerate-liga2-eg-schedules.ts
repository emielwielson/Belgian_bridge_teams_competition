/**
 * Regenerate Flanders Liga 2 E and G schedules after move-haacht2-2g-to-2e.sql.
 *
 * Usage (from web/):
 *   npx tsx scripts/regenerate-liga2-eg-schedules.ts
 *
 * Requires web/.env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
 *
 * Standings cache: next/cache revalidation only works inside Next.js. This script
 * prints the admin revalidate endpoints to hit after generation (or after rollback).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadGroupScoringContext } from "../lib/competition/match-scoring-context";
import { generateGroupScheduleInDb } from "../lib/scheduling/generate-group-schedule-db";
import { scheduledBoardCount } from "../lib/scoring/board-count-rules";

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

type Liga2Group = { id: string; name: string };

async function resolveLiga2EG(
  supabase: SupabaseClient,
): Promise<{ groupE: Liga2Group; groupG: Liga2Group }> {
  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("is_active", true)
    .single();
  if (seasonError || !season) {
    throw seasonError ?? new Error("No active season");
  }

  const { data: rows, error } = await supabase
    .from("groups")
    .select(
      `
      id,
      name,
      division:divisions!inner (
        name,
        league:leagues!inner (
          season_id,
          scope,
          region:regions!inner ( code )
        )
      )
    `,
    )
    .in("name", ["LIGA 2 E", "LIGA 2 G"]);

  if (error) throw error;

  const filtered = (rows ?? []).filter((row) => {
    const division = Array.isArray(row.division) ? row.division[0] : row.division;
    const league = division?.league
      ? Array.isArray(division.league)
        ? division.league[0]
        : division.league
      : null;
    const region = league?.region
      ? Array.isArray(league.region)
        ? league.region[0]
        : league.region
      : null;
    return (
      division?.name === "LIGA 2" &&
      league?.season_id === season.id &&
      league?.scope === "regional" &&
      region?.code === "flanders"
    );
  });

  const groupE = filtered.find((g) => g.name === "LIGA 2 E");
  const groupG = filtered.find((g) => g.name === "LIGA 2 G");
  if (!groupE || !groupG) {
    throw new Error("Flanders LIGA 2 groups E and/or G not found");
  }

  console.log(`Season: ${season.name}`);
  return {
    groupE: { id: groupE.id, name: "E" },
    groupG: { id: groupG.id, name: "G" },
  };
}

async function assertReadyForGenerate(
  supabase: SupabaseClient,
  groupEId: string,
  groupGId: string,
) {
  const { data: haacht, error: teamError } = await supabase
    .from("teams")
    .select("id, name, group_id")
    .eq("name", "Haacht 2")
    .eq("group_id", groupEId)
    .maybeSingle();
  if (teamError) throw teamError;
  if (!haacht) {
    throw new Error(
      "Haacht 2 not found in LIGA 2 E — run move-haacht2-2g-to-2e.sql first",
    );
  }

  const { data: eSlot8, error: eSlotError } = await supabase
    .from("group_schedule_slots")
    .select("slot, team_id, is_bye")
    .eq("group_id", groupEId)
    .eq("slot", 8)
    .maybeSingle();
  if (eSlotError) throw eSlotError;
  if (!eSlot8 || eSlot8.is_bye || eSlot8.team_id !== haacht.id) {
    throw new Error("LIGA 2 E slot 8 must be Haacht 2 (not bye)");
  }

  const { data: gSlot3, error: gSlotError } = await supabase
    .from("group_schedule_slots")
    .select("slot, team_id, is_bye")
    .eq("group_id", groupGId)
    .eq("slot", 3)
    .maybeSingle();
  if (gSlotError) throw gSlotError;
  if (!gSlot3 || !gSlot3.is_bye || gSlot3.team_id !== null) {
    throw new Error("LIGA 2 G slot 3 must be bye");
  }

  for (const [label, groupId] of [
    ["E", groupEId],
    ["G", groupGId],
  ] as const) {
    const { count: matchCount, error: matchError } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId);
    if (matchError) throw matchError;
    if ((matchCount ?? 0) > 0) {
      throw new Error(
        `LIGA 2 ${label} still has ${matchCount} matches; clear before regenerate`,
      );
    }

    const { count: byeCount, error: byeError } = await supabase
      .from("group_bye_rounds")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId);
    if (byeError) throw byeError;
    if ((byeCount ?? 0) > 0) {
      throw new Error(
        `LIGA 2 ${label} still has ${byeCount} bye rows; clear before regenerate`,
      );
    }
  }

  const { count: countE } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupEId);
  const { count: countG } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupGId);

  if (countE !== 8 || countG !== 7) {
    throw new Error(`Unexpected team counts after move (E=${countE}, G=${countG}); expected E=8 G=7`);
  }
}

async function generateOne(supabase: SupabaseClient, group: Liga2Group) {
  const scoringContext = await loadGroupScoringContext(supabase, group.id);
  const boardCount = scheduledBoardCount(scoringContext);
  const result = await generateGroupScheduleInDb(supabase, group.id, boardCount);
  const byeNote =
    result.byesCreated > 0 ? `, ${result.byesCreated} bye rounds` : "";
  console.log(
    `  Liga 2${group.name}: ${result.matchesCreated} matches${byeNote}`,
  );
  return result;
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

  const { groupE, groupG } = await resolveLiga2EG(supabase);
  console.log(`Groups: E=${groupE.id}, G=${groupG.id}`);

  await assertReadyForGenerate(supabase, groupE.id, groupG.id);
  console.log("Preconditions OK. Generating schedules…");

  await generateOne(supabase, groupE);
  await generateOne(supabase, groupG);

  const appUrl = (
    process.env.STANDINGS_REVALIDATE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");

  console.log(`Revalidating standings cache at ${appUrl}…`);
  const revalidateRes = await fetch(`${appUrl}/api/cron/revalidate-standings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ops-secret": secret,
    },
    body: JSON.stringify({ groupIds: [groupE.id, groupG.id] }),
  });
  const revalidateBody = await revalidateRes.json().catch(() => ({}));
  if (!revalidateRes.ok) {
    console.warn(
      `Standings revalidate failed (${revalidateRes.status}):`,
      revalidateBody,
    );
    console.warn(
      "Hard refresh will not clear unstable_cache. Fix the app URL / secret and retry, or restart Next.js.",
    );
  } else {
    console.log("Standings cache revalidated:", revalidateBody);
  }

  console.log("Done.");
  console.log(
    "Backup tables ops_backup_haacht2_move_* kept until sign-off. Rollback: supabase/scripts/rollback-haacht2-2g-to-2e.sql",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
