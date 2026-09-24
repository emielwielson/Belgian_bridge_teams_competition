/**
 * One-off: inspect/clean Honor round boards on the Supabase project from ../.env
 *
 *   npx tsx scripts/cleanup-honor-round-boards.ts --round=4 --keep=1-16 --apply
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";
import { resolveActiveHonorGroup } from "../lib/competition/honor-seating-overview";

function loadEnvFile(absolutePath: string, overwrite: boolean) {
  if (!existsSync(absolutePath)) return false;
  for (const line of readFileSync(absolutePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (overwrite || !process.env[key]) process.env[key] = value;
  }
  return true;
}

function argValue(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  return fallback;
}

function parseKeepRange(raw: string): { low: number; high: number } {
  const m = raw.match(/^(\d+)-(\d+)$/);
  if (!m) throw new Error(`Invalid --keep=${raw} (expected e.g. 1-16)`);
  return { low: Number(m[1]), high: Number(m[2]) };
}

async function main() {
  // Prefer repo-root .env (live Supabase branch), then web/.env.local.
  loadEnvFile(resolve(process.cwd(), "../.env"), true);
  loadEnvFile(resolve(process.cwd(), ".env.local"), false);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
    process.exit(1);
  }

  const round = Number(argValue("round", "4"));
  const keep = parseKeepRange(argValue("keep", "1-16")!);
  const apply = process.argv.includes("--apply");

  console.log("Supabase:", new URL(url).host);
  console.log("Round:", round, "keep:", `${keep.low}-${keep.high}`, "apply:", apply);

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
  });

  const group = await resolveActiveHonorGroup(supabase);
  if (!group) {
    console.error("No active Honor group found.");
    process.exit(1);
  }
  console.log("Honor group:", group.id);

  const { data: boards, error } = await supabase
    .from("honor_boards")
    .select("id, board_number, publication_status")
    .eq("group_id", group.id)
    .eq("tournament_round", round)
    .order("board_number");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const list = boards ?? [];
  const numbers = list.map((b) => b.board_number);
  console.log("Board numbers now:", numbers.join(", ") || "(none)");
  console.log("Count:", list.length);

  const stale = list.filter(
    (b) => b.board_number < keep.low || b.board_number > keep.high,
  );
  console.log(
    "Stale to remove:",
    stale.map((b) => b.board_number).join(", ") || "(none)",
  );

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to delete stale boards.");
    return;
  }

  if (!stale.length) {
    console.log("Nothing to delete.");
    return;
  }

  const { error: delErr } = await supabase
    .from("honor_boards")
    .delete()
    .in(
      "id",
      stale.map((b) => b.id),
    );

  if (delErr) {
    console.error("Delete failed:", delErr.message);
    process.exit(1);
  }

  const { data: after } = await supabase
    .from("honor_boards")
    .select("board_number")
    .eq("group_id", group.id)
    .eq("tournament_round", round)
    .order("board_number");

  console.log(
    "After delete:",
    (after ?? []).map((b) => b.board_number).join(", "),
  );
  console.log("Removed", stale.length, "boards (results cascaded).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
