import { describe, expect, it } from "vitest";
import { bridgematePairNumber } from "./honor-bws-export";
import { buildHonorMappingContext } from "./honor-import-mapping";
import type { HonorRoundMatchSeating } from "@/lib/competition/honor-seating-overview";

function seat(
  team_id: string,
  room: "open" | "closed",
  direction: "N" | "S" | "E" | "W",
  player_id: string,
): HonorRoundMatchSeating["seats"][number] {
  return {
    player_id,
    name: player_id,
    team_id,
    room,
    direction,
    is_substitute: false,
  };
}

function readyMatch(
  overrides: Partial<HonorRoundMatchSeating> & {
    match_id: string;
    home_team: { id: string; name: string };
    away_team: { id: string; name: string };
    home_slot: number;
    away_slot: number;
    venue_tables: { openTable: number; closedTable: number };
  },
): HonorRoundMatchSeating {
  const home = overrides.home_team.id;
  const away = overrides.away_team.id;
  return {
    round: 1,
    datetime: "2026-01-01T10:00:00Z",
    board_count: 16,
    phase: "sequential",
    home_lineup_locked_at: "2026-01-01T09:00:00Z",
    away_lineup_locked_at: "2026-01-01T09:00:00Z",
    lock_status: "both",
    home_seats_complete: true,
    away_seats_complete: true,
    seats: [
      seat(home, "open", "N", `${home}-n`),
      seat(home, "open", "S", `${home}-s`),
      seat(away, "open", "E", `${away}-e`),
      seat(away, "open", "W", `${away}-w`),
      seat(away, "closed", "N", `${away}-n`),
      seat(away, "closed", "S", `${away}-s`),
      seat(home, "closed", "E", `${home}-e`),
      seat(home, "closed", "W", `${home}-w`),
    ],
    ...overrides,
  };
}

describe("buildHonorMappingContext", () => {
  it("uses same pair numbers as BWS export", () => {
    const match = readyMatch({
      match_id: "m1",
      home_team: { id: "t1", name: "Home" },
      away_team: { id: "t2", name: "Away" },
      home_slot: 1,
      away_slot: 2,
      venue_tables: { openTable: 1, closedTable: 2 },
    });

    const boards = [{ id: "b1", boardNumber: 1 }];
    const result = buildHonorMappingContext(1, [match], boards);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const pairNums = Object.fromEntries(
      result.ctx.pairs.map((p) => [p.id, p.bridgematePairNumber]),
    );
    expect(pairNums[`pair:t1:1`]).toBe(bridgematePairNumber(1, 1));
    expect(pairNums[`pair:t1:2`]).toBe(bridgematePairNumber(1, 2));
    expect(pairNums[`pair:t2:1`]).toBe(bridgematePairNumber(2, 1));
    expect(pairNums[`pair:t2:2`]).toBe(bridgematePairNumber(2, 2));

    expect(result.ctx.tables).toHaveLength(2);
    expect(result.ctx.tables[0]?.bridgemateTable).toBe(1);
    expect(result.ctx.tables[1]?.bridgemateTable).toBe(2);
  });
});
