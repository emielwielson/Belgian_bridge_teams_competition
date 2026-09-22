import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  applyHonorRoundMatchScores,
  assignedMatchImpsFromRoomAwards,
  computeHonorMatchImps,
  teamBoardImpsFromAwards,
} from "./honor-match-imps";
import type { HonorRoundMatchSeating } from "@/lib/competition/honor-seating-overview";

vi.mock("@/lib/scoring/vp-lookup", () => ({
  lookupVp: vi.fn(),
}));

import { lookupVp } from "@/lib/scoring/vp-lookup";

describe("computeHonorMatchImps", () => {
  it("returns zeros for an empty board list", () => {
    expect(computeHonorMatchImps([])).toEqual({ impsHome: 0, impsAway: 0 });
  });

  it("awards home IMPs when open outscores closed", () => {
    // 20-point swing → 1 IMP
    expect(
      computeHonorMatchImps([{ openNs: 420, closedNs: 400 }]),
    ).toEqual({ impsHome: 1, impsAway: 0 });
  });

  it("awards away IMPs when closed outscores open", () => {
    // −120 → 3 IMPs to away
    expect(
      computeHonorMatchImps([{ openNs: 400, closedNs: 520 }]),
    ).toEqual({ impsHome: 0, impsAway: 3 });
  });

  it("aggregates swings both ways", () => {
    const result = computeHonorMatchImps([
      { openNs: 420, closedNs: 400 }, // +1 home
      { openNs: 400, closedNs: 520 }, // +3 away
      { openNs: 100, closedNs: 100 }, // 0
    ]);
    expect(result).toEqual({ impsHome: 1, impsAway: 3 });
  });

  it("sums assigned average_pm boards with compared boards", () => {
    expect(
      computeHonorMatchImps([
        { kind: "assigned", homeImps: 3, awayImps: -3 },
        { openNs: 420, closedNs: 400 },
      ]),
    ).toEqual({ impsHome: 4, impsAway: 0 });
  });
});

describe("assigned average match IMPs", () => {
  it("prefers G- when a team has both awards across rooms", () => {
    expect(teamBoardImpsFromAwards(["plus", "minus"])).toBe(-3);
    expect(
      assignedMatchImpsFromRoomAwards({
        openNs: "plus",
        openEw: null,
        closedNs: null,
        closedEw: "minus",
      }),
    ).toEqual({ homeImps: -3, awayImps: 0 });
  });

  it("treats zero awards as 0 match IMPs", () => {
    expect(teamBoardImpsFromAwards(["zero", "zero"])).toBe(0);
    expect(teamBoardImpsFromAwards(["zero", "plus"])).toBe(3);
    expect(teamBoardImpsFromAwards(["zero", "minus"])).toBe(-3);
    expect(
      assignedMatchImpsFromRoomAwards({
        openNs: "zero",
        openEw: "zero",
        closedNs: "zero",
        closedEw: "zero",
      }),
    ).toEqual({ homeImps: 0, awayImps: 0 });
  });
});

function seating(matchId: string): HonorRoundMatchSeating {
  return {
    match_id: matchId,
    round: 1,
    datetime: "2026-01-01T10:00:00Z",
    board_count: 16,
    phase: "blind",
    home_team: { id: "h1", name: "Home" },
    away_team: { id: "a1", name: "Away" },
    home_slot: 1,
    away_slot: 2,
    home_lineup_locked_at: "2026-01-01T09:00:00Z",
    away_lineup_locked_at: "2026-01-01T09:00:00Z",
    lock_status: "both",
    home_seats_complete: true,
    away_seats_complete: true,
    venue_tables: { openTable: 1, closedTable: 2 },
    seats: [],
  };
}

describe("applyHonorRoundMatchScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookupVp).mockResolvedValue({ vpHome: 12, vpAway: 8 });
  });

  it("updates matches with computed IMPs and VPs", async () => {
    const updates: unknown[] = [];
    const logs: unknown[] = [];

    const service = {
      from: (table: string) => {
        if (table === "matches") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "m1",
                      board_count: 16,
                      vp_board_count: null,
                    },
                  ],
                  error: null,
                }),
            }),
            update: (payload: unknown) => ({
              eq: () => {
                updates.push(payload);
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        if (table === "honor_board_results") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  in: () =>
                    Promise.resolve({
                      data: [
                        {
                          match_id: "m1",
                          room: "open",
                          board_id: "b1",
                          ns_score: 420,
                          computed_score: 420,
                          admin_adjusted_ns_score: null,
                        },
                        {
                          match_id: "m1",
                          room: "closed",
                          board_id: "b1",
                          ns_score: 400,
                          computed_score: 400,
                          admin_adjusted_ns_score: null,
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === "match_logs") {
          return {
            insert: (row: unknown) => {
              logs.push(row);
              return Promise.resolve({ error: null });
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    const result = await applyHonorRoundMatchScores(service as never, {
      groupId: "g1",
      tournamentRound: 1,
      matches: [seating("m1")],
      userId: "u1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scores).toEqual([
      {
        matchId: "m1",
        impsHome: 1,
        impsAway: 0,
        vpHome: 12,
        vpAway: 8,
      },
    ]);
    expect(updates).toEqual([
      {
        imps_home: 1,
        imps_away: 0,
        vp_home: 12,
        vp_away: 8,
        vp_board_count: 1,
      },
    ]);
    expect(lookupVp).toHaveBeenCalledWith(
      service,
      expect.objectContaining({
        groupId: "g1",
        boardCount: 1,
        impsHome: 1,
        impsAway: 0,
      }),
    );
    expect(logs).toHaveLength(1);
  });

  it("uses boards played for VP scale when some boards are NG", async () => {
    const updates: unknown[] = [];

    const service = {
      from: (table: string) => {
        if (table === "matches") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [{ id: "m1", board_count: 16, vp_board_count: 16 }],
                  error: null,
                }),
            }),
            update: (payload: unknown) => ({
              eq: () => {
                updates.push(payload);
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        if (table === "honor_board_results") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  in: () =>
                    Promise.resolve({
                      data: [
                        {
                          match_id: "m1",
                          room: "open",
                          board_id: "b1",
                          ns_score: 100,
                          computed_score: 100,
                          admin_adjusted_ns_score: null,
                          included_in_match_score: false,
                        },
                        {
                          match_id: "m1",
                          room: "closed",
                          board_id: "b1",
                          ns_score: 50,
                          computed_score: 50,
                          admin_adjusted_ns_score: null,
                          included_in_match_score: false,
                        },
                        {
                          match_id: "m1",
                          room: "open",
                          board_id: "b2",
                          ns_score: 420,
                          computed_score: 420,
                          admin_adjusted_ns_score: null,
                          included_in_match_score: true,
                        },
                        {
                          match_id: "m1",
                          room: "closed",
                          board_id: "b2",
                          ns_score: 400,
                          computed_score: 400,
                          admin_adjusted_ns_score: null,
                          included_in_match_score: true,
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    const result = await applyHonorRoundMatchScores(service as never, {
      groupId: "g1",
      tournamentRound: 1,
      matches: [seating("m1")],
      userId: null,
    });

    expect(result.ok).toBe(true);
    expect(lookupVp).toHaveBeenCalledWith(
      service,
      expect.objectContaining({ boardCount: 1, allowWbfFallback: true }),
    );
    expect(updates[0]).toEqual(
      expect.objectContaining({ vp_board_count: 1 }),
    );
  });

  it("fails when a room score is missing", async () => {
    const service = {
      from: (table: string) => {
        if (table === "matches") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: [{ id: "m1", board_count: 16, vp_board_count: null }],
                  error: null,
                }),
            }),
          };
        }
        if (table === "honor_board_results") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  in: () =>
                    Promise.resolve({
                      data: [
                        {
                          match_id: "m1",
                          room: "open",
                          board_id: "b1",
                          ns_score: 100,
                          computed_score: null,
                          admin_adjusted_ns_score: null,
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    const result = await applyHonorRoundMatchScores(service as never, {
      groupId: "g1",
      tournamentRound: 1,
      matches: [seating("m1")],
      userId: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/incomplete open\/closed/i);
  });
});
