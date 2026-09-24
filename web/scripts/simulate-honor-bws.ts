/**
 * Build a Bridgemate .bws for Honor round N with simulated ReceivedData
 * matching the current seated line-ups.
 *
 * Usage (from web/):
 *   npx tsx scripts/simulate-honor-bws.ts
 *   npx tsx scripts/simulate-honor-bws.ts --round=1 --out=fixtures/bridgemate/honneur-ronde-1-simulated.bws
 *
 * Requires web/.env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";
import { exportHonorRoundBws } from "../lib/bridgemate/honor-bws-export";
import { simulateReceivedDataFromPlan } from "../lib/bridgemate/simulate-received";
import { writeBwsFromPlan } from "../lib/bridgemate/write-bws";
import {
  loadHonorRoundSeating,
  resolveActiveHonorGroup,
} from "../lib/competition/honor-seating-overview";

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

function argValue(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
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

  const round = Number(argValue("round", "1"));
  if (!Number.isInteger(round) || round < 1) {
    console.error("Invalid --round");
    process.exit(1);
  }

  const outPath = resolve(
    process.cwd(),
    argValue(
      "out",
      `fixtures/bridgemate/honneur-ronde-${round}-simulated.bws`,
    ),
  );

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
  });

  const group = await resolveActiveHonorGroup(supabase);
  if (!group) {
    console.error("Geen actieve Honneur-groep gevonden.");
    process.exit(1);
  }

  const seating = await loadHonorRoundSeating(supabase, group, round);

  const { data: boardRows, error: boardsError } = await supabase
    .from("honor_boards")
    .select("board_number, hands")
    .eq("group_id", group.id)
    .eq("tournament_round", round)
    .order("board_number", { ascending: true });
  if (boardsError) {
    console.error(boardsError.message);
    process.exit(1);
  }
  const boards = (boardRows ?? [])
    .filter((row) => row.hands != null)
    .map((row) => ({
      board_number: row.board_number as number,
      hands: row.hands as import("../lib/boards/types").BoardHands,
    }));

  const exported = exportHonorRoundBws(round, seating.matches, boards, {
    guid: `sim-honor-r${round}-0000-0000-0000-000000000001`,
    now: new Date("2026-09-18T12:00:00Z"),
  });
  if (!exported.ok) {
    console.error("Kan sessieplan niet bouwen:");
    for (const e of exported.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const received = simulateReceivedDataFromPlan(exported.plan, {
    seed: 20260918 + round,
    now: new Date("2026-09-18T14:30:00Z"),
  });

  const buffer = writeBwsFromPlan(
    exported.plan,
    undefined,
    new Date("2026-09-18T12:00:00Z"),
    received,
  );

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buffer);

  console.log(`Wrote ${outPath}`);
  console.log(
    `Session "${exported.plan.session.name}": ${exported.plan.tables.length} tables, ${received.length} ReceivedData rows`,
  );
  for (const m of seating.matches) {
    const vt = m.venue_tables!;
    console.log(
      `  tables ${vt.openTable}-${vt.closedTable}: ${m.home_team.name} (slot ${m.home_slot}) vs ${m.away_team.name} (slot ${m.away_slot}), ${m.board_count} boards`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
