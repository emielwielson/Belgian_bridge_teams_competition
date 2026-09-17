/**
 * Import the simulated honor .bws against the live DB (service role).
 * Usage (from web/): npx tsx scripts/import-simulated-honor-bws.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";
import { importHonorBwsForRound } from "../lib/bridgemate/import-round";
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

async function main() {
  loadEnvFile(".env.local");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws },
    },
  );
  const group = await resolveActiveHonorGroup(sb);
  if (!group) throw new Error("no honor group");
  const seating = await loadHonorRoundSeating(sb, group, 1);
  const buffer = readFileSync(
    resolve("fixtures/bridgemate/honneur-ronde-1-simulated.bws"),
  );
  const result = await importHonorBwsForRound({
    service: sb,
    groupId: group.id,
    tournamentRound: 1,
    matches: seating.matches,
    buffer,
    filename: "honneur-ronde-1-simulated.bws",
    replace: true,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
