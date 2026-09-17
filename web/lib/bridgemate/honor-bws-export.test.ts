import { describe, expect, it } from "vitest";
import {
  bridgematePairNumber,
  buildHonorBwsSessionInput,
  exportHonorRoundBws,
  honorRoundReadyForBws,
} from "./honor-bws-export";
import type { HonorRoundMatchSeating } from "@/lib/competition/honor-seating-overview";

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
  return {
    round: 1,
    datetime: "2026-01-01T10:00:00Z",
    board_count: 16,
    phase: "sequential",
    home_lineup_locked_at: "2026-01-01T09:00:00Z",
    away_lineup_locked_at: "2026-01-01T09:05:00Z",
    lock_status: "both",
    home_seats_complete: true,
    away_seats_complete: true,
    seats: [],
    ...overrides,
  };
}

describe("bridgematePairNumber", () => {
  it("uses slot*10 + room pair", () => {
    expect(bridgematePairNumber(3, 1)).toBe(31);
    expect(bridgematePairNumber(8, 2)).toBe(82);
  });
});

describe("buildHonorBwsSessionInput", () => {
  it("maps 4 matches to open/closed tables with derived pair numbers", () => {
    const matches = [
      readyMatch({
        match_id: "m1",
        home_team: { id: "t3", name: "T3" },
        away_team: { id: "t8", name: "T8" },
        home_slot: 3,
        away_slot: 8,
        venue_tables: { openTable: 1, closedTable: 2 },
      }),
      readyMatch({
        match_id: "m2",
        home_team: { id: "t1", name: "T1" },
        away_team: { id: "t5", name: "T5" },
        home_slot: 1,
        away_slot: 5,
        venue_tables: { openTable: 3, closedTable: 4 },
      }),
      readyMatch({
        match_id: "m3",
        home_team: { id: "t2", name: "T2" },
        away_team: { id: "t6", name: "T6" },
        home_slot: 2,
        away_slot: 6,
        venue_tables: { openTable: 5, closedTable: 6 },
      }),
      readyMatch({
        match_id: "m4",
        home_team: { id: "t4", name: "T4" },
        away_team: { id: "t7", name: "T7" },
        home_slot: 4,
        away_slot: 7,
        venue_tables: { openTable: 7, closedTable: 8 },
      }),
    ];

    const built = buildHonorBwsSessionInput(1, matches);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.input.matches).toHaveLength(4);
    expect(built.input.matches[0].tables).toEqual([
      {
        id: "m1:open",
        bridgemateSection: "A",
        bridgemateTable: 1,
        nsPairId: "pair:t3:1",
        ewPairId: "pair:t8:1",
      },
      {
        id: "m1:closed",
        bridgemateSection: "A",
        bridgemateTable: 2,
        nsPairId: "pair:t8:2",
        ewPairId: "pair:t3:2",
      },
    ]);

    const exported = exportHonorRoundBws(1, matches, {
      guid: "11111111-2222-3333-4444-555555555555",
    });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    expect(exported.plan.filename).toBe("honneur-ronde-1.bws");
    expect(exported.plan.tables).toHaveLength(8);
    expect(exported.plan.roundData).toHaveLength(8);
    expect(exported.plan.roundData[0]).toMatchObject({
      table: 1,
      nsPair: 31,
      ewPair: 81,
      highBoard: 16,
    });
    expect(exported.plan.roundData[1]).toMatchObject({
      table: 2,
      nsPair: 82,
      ewPair: 32,
    });
    expect(exported.plan.tables.map((t) => [t.table, t.group])).toEqual([
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 2],
      [5, 3],
      [6, 3],
      [7, 4],
      [8, 4],
    ]);
    expect(exported.buffer.length).toBeGreaterThan(0);
  });

  it("rejects incomplete lineups", () => {
    const matches = [
      readyMatch({
        match_id: "m1",
        home_team: { id: "t1", name: "Home" },
        away_team: { id: "t2", name: "Away" },
        home_slot: 1,
        away_slot: 2,
        venue_tables: { openTable: 1, closedTable: 2 },
        lock_status: "away_only",
        home_lineup_locked_at: null,
      }),
    ];
    expect(honorRoundReadyForBws(matches).length).toBeGreaterThan(0);
    const built = buildHonorBwsSessionInput(1, matches);
    expect(built.ok).toBe(false);
  });
});
