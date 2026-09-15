/**
 * Regenerate Flanders Liga 3 B schedule after fill-liga3b-bye-with-team.sql.
 *
 * Usage (from web/):
 *   npx tsx scripts/regenerate-liga3b-schedule.ts
 *
 * Requires web/.env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
 *
 * Standings cache: next/cache revalidation only works inside Next.js. This script
 * posts to the revalidate cron endpoint after generation.
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

type Liga3BGroup = { id: string; name: string };

async function resolveLiga3B(
  supabase: SupabaseClient,
): Promise<{ group: Liga3BGroup; seasonName: string }> {
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
    .eq("name", "LIGA 3 B");

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
      division?.name === "LIGA 3" &&
      league?.season_id === season.id &&
      league?.scope === "regional" &&
      region?.code === "flanders"
    );
  });

  const group = filtered[0];
  if (!group) {
    throw new Error("Flanders LIGA 3 B group not found");
  }

  return {
    group: { id: group.id, name: "LIGA 3 B" },
    seasonName: season.name,
  };
}

async function assertReadyForGenerate(
  supabase: SupabaseClient,
  groupId: string,
) {
  const { data: metaRows, error: metaError } = await supabase
    .from("ops_backup_liga3b_bye_fill_meta")
    .select("team_id, team_name, bye_slot, group_id")
    .limit(1);

  // Backup meta is postgres-only (RLS, no grants). Prefer slot/team checks when
  // the service role cannot read ops backup tables.
  let expectedTeamId: string | null = null;
  let expectedSlot: number | null = null;
  if (!metaError && metaRows?.[0]) {
    const meta = metaRows[0];
    if (meta.group_id !== groupId) {
      throw new Error("Backup meta group_id does not match LIGA 3 B");
    }
    expectedTeamId = meta.team_id;
    expectedSlot = meta.bye_slot;
    console.log(
      `Backup meta: team="${meta.team_name}" slot=${meta.bye_slot}`,
    );
  } else if (metaError) {
    console.warn(
      "Could not read ops_backup_liga3b_bye_fill_meta (expected if RLS blocks API). Continuing with slot checks.",
    );
  }

  const { count: teamCount, error: teamCountError } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if (teamCountError) throw teamCountError;
  if (teamCount !== 8) {
    throw new Error(
      `Expected 8 teams in LIGA 3 B after fill, found ${teamCount}`,
    );
  }

  const { data: slots, error: slotsError } = await supabase
    .from("group_schedule_slots")
    .select("slot, team_id, is_bye")
    .eq("group_id", groupId)
    .order("slot");
  if (slotsError) throw slotsError;

  const byeSlots = (slots ?? []).filter((s) => s.is_bye);
  if (byeSlots.length !== 0) {
    throw new Error(
      `LIGA 3 B still has ${byeSlots.length} bye slot(s); run fill-liga3b-bye-with-team.sql first`,
    );
  }

  const assigned = (slots ?? []).filter((s) => s.team_id && !s.is_bye);
  if (assigned.length !== 8) {
    throw new Error(
      `Expected 8 assigned slots, found ${assigned.length}`,
    );
  }

  if (expectedTeamId != null && expectedSlot != null) {
    const filled = (slots ?? []).find((s) => s.slot === expectedSlot);
    if (
      !filled ||
      filled.is_bye ||
      filled.team_id !== expectedTeamId
    ) {
      throw new Error(
        `Slot ${expectedSlot} must be the new team from backup meta`,
      );
    }
  }

  const { count: matchCount, error: matchError } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if (matchError) throw matchError;
  if ((matchCount ?? 0) > 0) {
    throw new Error(
      `LIGA 3 B still has ${matchCount} matches; clear before regenerate (re-run fill SQL if needed)`,
    );
  }

  const { count: byeCount, error: byeError } = await supabase
    .from("group_bye_rounds")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  if (byeError) throw byeError;
  if ((byeCount ?? 0) > 0) {
    throw new Error(
      `LIGA 3 B still has ${byeCount} bye rows; clear before regenerate`,
    );
  }
}

async function generateOne(supabase: SupabaseClient, group: Liga3BGroup) {
  const scoringContext = await loadGroupScoringContext(supabase, group.id);
  const boardCount = scheduledBoardCount(scoringContext);
  const result = await generateGroupScheduleInDb(supabase, group.id, boardCount);
  const byeNote =
    result.byesCreated > 0 ? `, ${result.byesCreated} bye rounds` : "";
  console.log(
    `  ${group.name}: ${result.matchesCreated} matches${byeNote}`,
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

  const { group, seasonName } = await resolveLiga3B(supabase);
  console.log(`Season: ${seasonName}`);
  console.log(`Group: ${group.name} (${group.id})`);

  await assertReadyForGenerate(supabase, group.id);
  console.log("Preconditions OK. Generating schedule…");

  await generateOne(supabase, group);

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
    body: JSON.stringify({ groupIds: [group.id] }),
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
    "Backup tables ops_backup_liga3b_bye_fill_* kept until sign-off. Rollback: supabase/scripts/rollback-liga3b-bye-fill.sql",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
