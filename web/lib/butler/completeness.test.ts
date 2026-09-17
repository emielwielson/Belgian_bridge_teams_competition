import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishHonorRound } from "./completeness";
import type { HonorRoundMatchSeating } from "@/lib/competition/honor-seating-overview";

vi.mock("@/lib/scoring/honor-match-imps", () => ({
  applyHonorRoundMatchScores: vi.fn(),
}));

import { applyHonorRoundMatchScores } from "@/lib/scoring/honor-match-imps";

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
    home_lineup_locked_at: "x",
    away_lineup_locked_at: "x",
    lock_status: "both",
    home_seats_complete: true,
    away_seats_complete: true,
    venue_tables: { openTable: 1, closedTable: 2 },
    seats: [],
  };
}

describe("publishHonorRound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies match scores before publishing and returns them", async () => {
    const boardUpdates: unknown[] = [];
    const resultUpdates: unknown[] = [];
    const pubInserts: unknown[] = [];

    const service = {
      from: (table: string) => {
        if (table === "honor_boards") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () =>
                    Promise.resolve({
                      data: [{ id: "b1", board_number: 1 }],
                      error: null,
                    }),
                }),
              }),
            }),
            update: (payload: unknown) => ({
              eq: () => ({
                eq: () => {
                  boardUpdates.push(payload);
                  return Promise.resolve({ error: null });
                },
              }),
            }),
          };
        }
        if (table === "honor_board_results") {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "r1",
                        match_id: "m1",
                        room: "open",
                        board_id: "b1",
                        validation_status: "valid",
                        special_result_kind: "none",
                      },
                      {
                        id: "r2",
                        match_id: "m1",
                        room: "closed",
                        board_id: "b1",
                        validation_status: "valid",
                        special_result_kind: "none",
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
            update: (payload: unknown) => ({
              eq: () => ({
                eq: () => {
                  resultUpdates.push(payload);
                  return Promise.resolve({ error: null });
                },
              }),
            }),
          };
        }
        if (table === "honor_round_publication") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
            insert: (row: unknown) => {
              pubInserts.push(row);
              return Promise.resolve({ error: null });
            },
          };
        }
        throw new Error(`unexpected ${table}`);
      },
    };

    vi.mocked(applyHonorRoundMatchScores).mockResolvedValue({
      ok: true,
      scores: [
        {
          matchId: "m1",
          impsHome: 10,
          impsAway: 4,
          vpHome: 14,
          vpAway: 6,
        },
      ],
    });

    const result = await publishHonorRound(service as never, {
      groupId: "g1",
      tournamentRound: 1,
      matches: [seating("m1")],
      publishedBy: "u1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scores[0]?.impsHome).toBe(10);
    expect(applyHonorRoundMatchScores).toHaveBeenCalled();
    expect(boardUpdates).toHaveLength(1);
    expect(resultUpdates).toHaveLength(1);
    expect(pubInserts).toHaveLength(1);
  });

  it("does not publish when scoring fails", async () => {
    const boardUpdates: unknown[] = [];

    const service = {
      from: (table: string) => {
        if (table === "honor_boards") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () =>
                    Promise.resolve({
                      data: [{ id: "b1", board_number: 1 }],
                      error: null,
                    }),
                }),
              }),
            }),
            update: (payload: unknown) => ({
              eq: () => ({
                eq: () => {
                  boardUpdates.push(payload);
                  return Promise.resolve({ error: null });
                },
              }),
            }),
          };
        }
        if (table === "honor_board_results") {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "r1",
                        match_id: "m1",
                        room: "open",
                        board_id: "b1",
                        validation_status: "valid",
                        special_result_kind: "none",
                      },
                      {
                        id: "r2",
                        match_id: "m1",
                        room: "closed",
                        board_id: "b1",
                        validation_status: "valid",
                        special_result_kind: "none",
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }
        throw new Error(`unexpected ${table}`);
      },
    };

    vi.mocked(applyHonorRoundMatchScores).mockResolvedValue({
      ok: false,
      error: "VP table missing",
    });

    const result = await publishHonorRound(service as never, {
      groupId: "g1",
      tournamentRound: 1,
      matches: [seating("m1")],
      publishedBy: "u1",
    });

    expect(result.ok).toBe(false);
    expect(boardUpdates).toHaveLength(0);
  });
});
