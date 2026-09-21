import { describe, expect, it } from "vitest";
import {
  buildAveragePmAdjustment,
  buildCancelledAdjustment,
  buildSplitAdjustment,
  buildWeightedAdjustment,
  computeWeightedScores,
  hasAveragePmAward,
  parseAveragePmAwards,
} from "./adjustment-helpers";
import {
  assignedMatchImpsFromRoomAwards,
  computeHonorMatchImps,
  groupHonorMatchBoardPairs,
  teamBoardImpsFromAwards,
} from "@/lib/scoring/honor-match-imps";
import { scoreBoard, type ButlerResultInput } from "@/lib/butler/engine";
import { pointsToImps } from "@/lib/scoring/wbf-imp-table";

describe("adjustment-helpers", () => {
  it("computes multi-leg weighted NS and EW scores with different weights", () => {
    const scores = computeWeightedScores({
      legs: [
        { score: 100, weightNs: 1, weightEw: 2 },
        { score: 200, weightNs: 1, weightEw: 1 },
        { score: 0, weightNs: 2, weightEw: 1 },
      ],
    });
    // NS: (100+200+0)/4 = 75
    // EW: (200+200+0)/4 = 100
    expect(scores).toEqual({ computedNs: 75, computedEw: 100 });
  });

  it("builds cancelled adjustment excluding datum and match", () => {
    const a = buildCancelledAdjustment({ reason: "TD" });
    expect(a.specialResultKind).toBe("NOT_PLAYED");
    expect(a.includedInDatum).toBe(false);
    expect(a.includedInMatchScore).toBe(false);
    expect(a.adjustmentMode).toBe("cancelled");
  });

  it("builds split with independent datum scores", () => {
    const a = buildSplitAdjustment({
      adminAdjustedNsScore: 100,
      adminAdjustedEwScore: 50,
    });
    expect(a.adminAdjustedNsScore).toBe(100);
    expect(a.adminAdjustedEwScore).toBe(50);
    expect(a.adminNsButlerImps).toBeNull();
    expect(a.adminEwButlerImps).toBeNull();
    expect(a.includedInMatchScore).toBe(true);
    expect(a.includedInDatum).toBe(true);
  });

  it("builds weighted and stores meta for N legs", () => {
    const a = buildWeightedAdjustment({
      legs: [
        { score: 100, weightNs: 1, weightEw: 1 },
        { score: 0, weightNs: 1, weightEw: 3 },
      ],
    });
    expect(a.adminAdjustedNsScore).toBe(50);
    expect(a.adminAdjustedEwScore).toBe(25);
    expect(a.adjustmentMeta?.computedNsScore).toBe(50);
    expect(a.adjustmentMeta?.computedEwScore).toBe(25);
  });

  it("builds average_pm excluding datum, including match, without frozen IMPs", () => {
    const a = buildAveragePmAdjustment({
      nsAward: "plus",
      ewAward: "minus",
      reason: "ruling",
    });
    expect(a.specialResultKind).toBe("ADJUSTED");
    expect(a.adjustmentMode).toBe("average_pm");
    expect(a.includedInDatum).toBe(false);
    expect(a.includedInMatchScore).toBe(true);
    expect(a.adminAdjustedNsScore).toBeNull();
    expect(a.adminNsButlerImps).toBeNull();
    expect(a.adminEwButlerImps).toBeNull();
    expect(a.adjustmentMeta).toEqual({
      reason: "ruling",
      nsAward: "plus",
      ewAward: "minus",
    });
    expect(hasAveragePmAward(a.adjustmentMeta)).toBe(true);
  });

  it("allows both sides the same average award", () => {
    const a = buildAveragePmAdjustment({ nsAward: "plus", ewAward: "plus" });
    expect(parseAveragePmAwards(a.adjustmentMeta)).toEqual({
      nsAward: "plus",
      ewAward: "plus",
    });
  });

  it("requires at least one average award", () => {
    expect(() => buildAveragePmAdjustment({})).toThrow(/minstens één/i);
  });
});

describe("Butler split datum scores", () => {
  it("uses independent EW datum scores when explicit", () => {
    const results: ButlerResultInput[] = [
      {
        id: "1",
        nsPairId: "a",
        ewPairId: "b",
        includedInDatum: true,
        nsScoreForDatum: 200,
        ewScoreForDatum: 100,
        adminNsButlerImps: null,
      },
      {
        id: "2",
        nsPairId: "c",
        ewPairId: "d",
        includedInDatum: true,
        nsScoreForDatum: 100,
        adminNsButlerImps: null,
      },
      {
        id: "3",
        nsPairId: "e",
        ewPairId: "f",
        includedInDatum: true,
        nsScoreForDatum: 110,
        adminNsButlerImps: null,
      },
      {
        id: "4",
        nsPairId: "g",
        ewPairId: "h",
        includedInDatum: true,
        nsScoreForDatum: 90,
        adminNsButlerImps: null,
      },
    ];
    const out = scoreBoard(results);
    expect(out.datumOk).toBe(true);
    expect(out.nsDatum).not.toBeNull();
    expect(out.ewDatum).not.toBeNull();
    // Explicit EW on id1 means independent EW path; EW IMPs need not equal −NS
    const split = out.results.find((r) => r.id === "1");
    expect(split?.nsButlerImps).toBe(
      pointsToImps(200 - (out.nsDatum as number)),
    );
    expect(split?.ewButlerImps).toBe(
      pointsToImps(100 - (out.ewDatum as number)),
    );
    expect(split?.usedAdminImps).toBe(false);
  });

  it("keeps zero-sum EW IMPs when no explicit EW score", () => {
    const results: ButlerResultInput[] = [
      {
        id: "1",
        nsPairId: "a",
        ewPairId: "b",
        includedInDatum: true,
        nsScoreForDatum: 110,
        adminNsButlerImps: null,
      },
      {
        id: "2",
        nsPairId: "c",
        ewPairId: "d",
        includedInDatum: true,
        nsScoreForDatum: 100,
        adminNsButlerImps: null,
      },
      {
        id: "3",
        nsPairId: "e",
        ewPairId: "f",
        includedInDatum: true,
        nsScoreForDatum: 90,
        adminNsButlerImps: null,
      },
      {
        id: "4",
        nsPairId: "g",
        ewPairId: "h",
        includedInDatum: true,
        nsScoreForDatum: 100,
        adminNsButlerImps: null,
      },
    ];
    const out = scoreBoard(results);
    expect(out.datumOk).toBe(true);
    expect(out.ewDatum).toBe(-(out.nsDatum as number));
    for (const row of out.results) {
      expect(row.ewButlerImps).toBe(-(row.nsButlerImps as number));
    }
  });

  it("still supports legacy admin IMP override", () => {
    const results: ButlerResultInput[] = [
      {
        id: "1",
        nsPairId: "a",
        ewPairId: "b",
        includedInDatum: false,
        nsScoreForDatum: null,
        adminNsButlerImps: 4,
        adminEwButlerImps: 1,
      },
      {
        id: "2",
        nsPairId: "c",
        ewPairId: "d",
        includedInDatum: true,
        nsScoreForDatum: 100,
        adminNsButlerImps: null,
      },
      {
        id: "3",
        nsPairId: "e",
        ewPairId: "f",
        includedInDatum: true,
        nsScoreForDatum: 110,
        adminNsButlerImps: null,
      },
      {
        id: "4",
        nsPairId: "g",
        ewPairId: "h",
        includedInDatum: true,
        nsScoreForDatum: 90,
        adminNsButlerImps: null,
      },
    ];
    const out = scoreBoard(results);
    const split = out.results.find((r) => r.id === "1");
    expect(split?.nsButlerImps).toBe(4);
    expect(split?.ewButlerImps).toBe(1);
    expect(split?.usedAdminImps).toBe(true);
  });

  it("excludes average_pm tables from datum while scoring other tables", () => {
    const results: ButlerResultInput[] = [
      {
        id: "avg",
        nsPairId: "a",
        ewPairId: "b",
        includedInDatum: false,
        nsScoreForDatum: null,
        adminNsButlerImps: null,
      },
      {
        id: "2",
        nsPairId: "c",
        ewPairId: "d",
        includedInDatum: true,
        nsScoreForDatum: 100,
        adminNsButlerImps: null,
      },
      {
        id: "3",
        nsPairId: "e",
        ewPairId: "f",
        includedInDatum: true,
        nsScoreForDatum: 110,
        adminNsButlerImps: null,
      },
      {
        id: "4",
        nsPairId: "g",
        ewPairId: "h",
        includedInDatum: true,
        nsScoreForDatum: 90,
        adminNsButlerImps: null,
      },
      {
        id: "5",
        nsPairId: "i",
        ewPairId: "j",
        includedInDatum: true,
        nsScoreForDatum: 105,
        adminNsButlerImps: null,
      },
    ];
    const out = scoreBoard(results);
    expect(out.datumOk).toBe(true);
    const avg = out.results.find((r) => r.id === "avg");
    expect(avg?.nsButlerImps).toBeNull();
    expect(avg?.ewButlerImps).toBeNull();
    expect(out.results.find((r) => r.id === "2")?.nsButlerImps).not.toBeNull();
  });
});

describe("computeHonorMatchImps", () => {
  it("aggregates remaining boards", () => {
    expect(
      computeHonorMatchImps([
        { openNs: 420, closedNs: 400 },
        { openNs: 400, closedNs: 520 },
      ]),
    ).toEqual({ impsHome: 1, impsAway: 3 });
  });

  it("skips boards excluded from match score", () => {
    const pairs = groupHonorMatchBoardPairs(
      [
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
      "m1",
    );
    expect(pairs).toEqual([{ openNs: 420, closedNs: 400 }]);
  });

  it("uses assigned ±3 IMPs for average_pm and ignores other table score", () => {
    const pairs = groupHonorMatchBoardPairs(
      [
        {
          match_id: "m1",
          room: "open",
          board_id: "b1",
          ns_score: null,
          computed_score: null,
          admin_adjusted_ns_score: null,
          included_in_match_score: true,
          adjustment_mode: "average_pm",
          adjustment_meta: { nsAward: "plus", ewAward: "minus" },
        },
        {
          match_id: "m1",
          room: "closed",
          board_id: "b1",
          ns_score: 620,
          computed_score: 620,
          admin_adjusted_ns_score: null,
          included_in_match_score: true,
        },
      ],
      "m1",
    );
    expect(pairs).toEqual([
      { kind: "assigned", homeImps: 3, awayImps: -3 },
    ]);
    expect(computeHonorMatchImps(pairs as never)).toEqual({
      impsHome: 3,
      impsAway: 0,
    });
  });
});

describe("teamBoardImpsFromAwards / assignedMatchImpsFromRoomAwards", () => {
  it("prefers minus when a team has both plus and minus", () => {
    expect(teamBoardImpsFromAwards(["plus", "minus"])).toBe(-3);
    expect(teamBoardImpsFromAwards(["plus", "plus"])).toBe(3);
    expect(teamBoardImpsFromAwards(["minus", "minus"])).toBe(-3);
    expect(teamBoardImpsFromAwards([null, null])).toBe(0);
  });

  it("maps open NS + closed EW to home and open EW + closed NS to away", () => {
    // Both rooms: home open NS +, home closed EW − → team G−
    expect(
      assignedMatchImpsFromRoomAwards({
        openNs: "plus",
        openEw: "minus",
        closedNs: "plus",
        closedEw: "minus",
      }),
    ).toEqual({ homeImps: -3, awayImps: -3 });

    expect(
      assignedMatchImpsFromRoomAwards({
        openNs: "plus",
        openEw: "minus",
        closedNs: null,
        closedEw: null,
      }),
    ).toEqual({ homeImps: 3, awayImps: -3 });

    expect(
      assignedMatchImpsFromRoomAwards({
        openNs: "plus",
        openEw: "plus",
        closedNs: "plus",
        closedEw: "plus",
      }),
    ).toEqual({ homeImps: 3, awayImps: 3 });
  });

  it("counts both-plus as 3–3 and both-minus as 0–0 in match totals", () => {
    expect(
      computeHonorMatchImps([
        { kind: "assigned", homeImps: 3, awayImps: 3 },
      ]),
    ).toEqual({ impsHome: 3, impsAway: 3 });
    expect(
      computeHonorMatchImps([
        { kind: "assigned", homeImps: -3, awayImps: -3 },
      ]),
    ).toEqual({ impsHome: 0, impsAway: 0 });
  });
});
