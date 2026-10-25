import { describe, expect, it, vi } from "vitest";
import {
  FORFAIT_MIN_VP,
  computeForfaitScores,
  forfaitWinnerVp,
  meanVp,
  recalculateGroupForfaits,
  roundVpHalfUp,
  type ScoredMatchForAverage,
} from "./forfait";

function scored(
  overrides: Partial<ScoredMatchForAverage> &
    Pick<ScoredMatchForAverage, "id" | "home_team_id" | "away_team_id">,
): ScoredMatchForAverage {
  return {
    vp_home: 14,
    vp_away: 6,
    played_at: "2026-01-01T12:00:00Z",
    forfait_side: null,
    ...overrides,
  };
}

describe("meanVp", () => {
  it("returns null for empty list", () => {
    expect(meanVp([])).toBeNull();
  });

  it("averages values", () => {
    expect(meanVp([10, 14])).toBe(12);
  });
});

describe("roundVpHalfUp", () => {
  it("rounds .5 up and below .5 down to 2 decimals", () => {
    expect(roundVpHalfUp(12.345)).toBe(12.35);
    expect(roundVpHalfUp(12.344)).toBe(12.34);
    expect(roundVpHalfUp(12.335)).toBe(12.34);
    expect(roundVpHalfUp(13.125)).toBe(13.13);
    expect(roundVpHalfUp(13.124)).toBe(13.12);
  });
});

describe("forfaitWinnerVp", () => {
  it("returns 12 when neither team has other scored matches", () => {
    const matches = [
      scored({
        id: "f1",
        home_team_id: "a",
        away_team_id: "b",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 12,
      }),
    ];
    expect(forfaitWinnerVp("b", "a", matches, "f1")).toBe(FORFAIT_MIN_VP);
  });

  it("uses max(12, average) when average is below 12", () => {
    const matches = [
      scored({
        id: "m1",
        home_team_id: "b",
        away_team_id: "c",
        vp_home: 8,
        vp_away: 12,
      }),
      scored({
        id: "m2",
        home_team_id: "b",
        away_team_id: "d",
        vp_home: 10,
        vp_away: 10,
      }),
      scored({
        id: "f1",
        home_team_id: "a",
        away_team_id: "b",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 12,
      }),
    ];
    // avg of 8 and 10 = 9 → max(12, 9) = 12
    expect(forfaitWinnerVp("b", "a", matches, "f1")).toBe(12);
  });

  it("uses average when above 12", () => {
    const matches = [
      scored({
        id: "m1",
        home_team_id: "b",
        away_team_id: "c",
        vp_home: 16,
        vp_away: 4,
      }),
      scored({
        id: "m2",
        home_team_id: "d",
        away_team_id: "b",
        vp_home: 6,
        vp_away: 14,
      }),
      scored({
        id: "f1",
        home_team_id: "a",
        away_team_id: "b",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 12,
      }),
    ];
    // avg of 16 and 14 = 15
    expect(forfaitWinnerVp("b", "a", matches, "f1")).toBe(15);
  });

  it("rounds average to 2 decimals half-up", () => {
    const matches = [
      scored({
        id: "m1",
        home_team_id: "b",
        away_team_id: "c",
        vp_home: 13.1,
        vp_away: 6.9,
      }),
      scored({
        id: "m2",
        home_team_id: "b",
        away_team_id: "d",
        vp_home: 13.2,
        vp_away: 6.8,
      }),
      scored({
        id: "m3",
        home_team_id: "b",
        away_team_id: "e",
        vp_home: 13.4,
        vp_away: 6.6,
      }),
      scored({
        id: "f1",
        home_team_id: "a",
        away_team_id: "b",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 12,
      }),
    ];
    // avg = (13.1 + 13.2 + 13.4) / 3 = 13.2333… → 13.23
    expect(forfaitWinnerVp("b", "a", matches, "f1")).toBe(13.23);
  });

  it("excludes other forfait matches from the average", () => {
    const matches = [
      scored({
        id: "m1",
        home_team_id: "b",
        away_team_id: "c",
        vp_home: 18,
        vp_away: 2,
      }),
      scored({
        id: "f-other",
        home_team_id: "b",
        away_team_id: "e",
        forfait_side: "away",
        vp_home: 20,
        vp_away: 0,
      }),
      scored({
        id: "f1",
        home_team_id: "a",
        away_team_id: "b",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 12,
      }),
    ];
    expect(forfaitWinnerVp("b", "a", matches, "f1")).toBe(18);
  });

  it("uses 20 - forfeiter average when that is the maximum", () => {
    const matches = [
      scored({
        id: "m-winner",
        home_team_id: "b",
        away_team_id: "c",
        vp_home: 13,
        vp_away: 7,
      }),
      scored({
        id: "m-forfeiter",
        home_team_id: "a",
        away_team_id: "d",
        vp_home: 4,
        vp_away: 16,
      }),
      scored({
        id: "f1",
        home_team_id: "a",
        away_team_id: "b",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 12,
      }),
    ];
    // max(12, 13, 20 - 4 = 16) = 16
    expect(forfaitWinnerVp("b", "a", matches, "f1")).toBe(16);
  });

  it("ignores 20 - forfeiter average when below other candidates", () => {
    const matches = [
      scored({
        id: "m-winner",
        home_team_id: "b",
        away_team_id: "c",
        vp_home: 17,
        vp_away: 3,
      }),
      scored({
        id: "m-forfeiter",
        home_team_id: "a",
        away_team_id: "d",
        vp_home: 14,
        vp_away: 6,
      }),
      scored({
        id: "f1",
        home_team_id: "a",
        away_team_id: "b",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 12,
      }),
    ];
    // max(12, 17, 20 - 14 = 6) = 17
    expect(forfaitWinnerVp("b", "a", matches, "f1")).toBe(17);
  });

  it("omits third term when forfeiter has no other played matches", () => {
    const matches = [
      scored({
        id: "m1",
        home_team_id: "b",
        away_team_id: "c",
        vp_home: 15,
        vp_away: 5,
      }),
      scored({
        id: "f1",
        home_team_id: "a",
        away_team_id: "b",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 12,
      }),
    ];
    expect(forfaitWinnerVp("b", "a", matches, "f1")).toBe(15);
  });

  it("excludes forfeiter forfait and unplayed matches from third-term average", () => {
    const matches = [
      scored({
        id: "m-winner",
        home_team_id: "b",
        away_team_id: "c",
        vp_home: 12,
        vp_away: 8,
      }),
      scored({
        id: "m-forfeiter-played",
        home_team_id: "a",
        away_team_id: "d",
        vp_home: 5,
        vp_away: 15,
      }),
      scored({
        id: "f-forfeiter-other",
        home_team_id: "a",
        away_team_id: "e",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 18,
      }),
      scored({
        id: "unplayed",
        home_team_id: "a",
        away_team_id: "f",
        vp_home: null,
        vp_away: null,
        played_at: null,
      }),
      scored({
        id: "f1",
        home_team_id: "a",
        away_team_id: "b",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 12,
      }),
    ];
    // forfeiter avg from played only = 5 → 20 - 5 = 15; max(12, 12, 15) = 15
    expect(forfaitWinnerVp("b", "a", matches, "f1")).toBe(15);
  });
});

describe("computeForfaitScores", () => {
  it("gives forfeiter 0 and winner the computed VP", () => {
    const matches = [
      scored({
        id: "m1",
        home_team_id: "away",
        away_team_id: "x",
        vp_home: 16,
        vp_away: 4,
      }),
    ];
    expect(
      computeForfaitScores("home", "home", "away", matches, "f1"),
    ).toEqual({ vpHome: 0, vpAway: 16, winnerVp: 16 });
  });

  it("applies third term via forfeiter average", () => {
    const matches = [
      scored({
        id: "m-winner",
        home_team_id: "away",
        away_team_id: "x",
        vp_home: 13,
        vp_away: 7,
      }),
      scored({
        id: "m-forfeiter",
        home_team_id: "home",
        away_team_id: "y",
        vp_home: 3,
        vp_away: 17,
      }),
    ];
    // max(12, 13, 20 - 3 = 17) = 17
    expect(
      computeForfaitScores("home", "home", "away", matches, "f1"),
    ).toEqual({ vpHome: 0, vpAway: 17, winnerVp: 17 });
  });
});

describe("recalculateGroupForfaits", () => {
  it("updates stale forfait VP when averages change", async () => {
    const rows: ScoredMatchForAverage[] = [
      scored({
        id: "m1",
        home_team_id: "winner",
        away_team_id: "other",
        vp_home: 16,
        vp_away: 4,
      }),
      scored({
        id: "f1",
        home_team_id: "loser",
        away_team_id: "winner",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 12,
      }),
    ];

    const updates: Array<Record<string, unknown>> = [];
    const supabase = {
      from: (table: string) => {
        if (table !== "matches") throw new Error(table);
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: rows,
                error: null,
              }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              updates.push({ id, ...payload });
              return Promise.resolve({ error: null });
            },
          }),
        };
      },
    };

    const updated = await recalculateGroupForfaits(supabase as never, "g1");
    expect(updated).toBe(1);
    expect(updates).toEqual([
      {
        id: "f1",
        vp_home: 0,
        vp_away: 16,
        imps_home: null,
        imps_away: null,
      },
    ]);
  });

  it("skips update when VP already correct", async () => {
    const rows: ScoredMatchForAverage[] = [
      scored({
        id: "m1",
        home_team_id: "winner",
        away_team_id: "other",
        vp_home: 16,
        vp_away: 4,
      }),
      scored({
        id: "f1",
        home_team_id: "loser",
        away_team_id: "winner",
        forfait_side: "home",
        vp_home: 0,
        vp_away: 16,
      }),
    ];

    const update = vi.fn();
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: rows, error: null }),
        }),
        update,
      }),
    };

    const updated = await recalculateGroupForfaits(supabase as never, "g1");
    expect(updated).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
