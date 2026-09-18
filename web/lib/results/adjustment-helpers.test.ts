import { describe, expect, it } from "vitest";
import {
  buildArtificialAdjustment,
  buildCancelledAdjustment,
  buildSplitAdjustment,
  buildWeightedAdjustment,
  computeWeightedNsScore,
  roundWeightedNsScore,
} from "./adjustment-helpers";
import { computeHonorMatchImps, groupHonorMatchBoardPairs } from "@/lib/scoring/honor-match-imps";
import { scoreBoard, type ButlerResultInput } from "@/lib/butler/engine";

describe("adjustment-helpers", () => {
  it("computes weighted NS score", () => {
    expect(
      computeWeightedNsScore({
        scoreA: 100,
        weightA: 1,
        scoreB: 200,
        weightB: 1,
      }),
    ).toBe(150);
    expect(
      roundWeightedNsScore({
        scoreA: 420,
        weightA: 2,
        scoreB: 50,
        weightB: 1,
      }),
    ).toBe(297);
  });

  it("builds cancelled adjustment excluding datum and match", () => {
    const a = buildCancelledAdjustment({ reason: "TD" });
    expect(a.specialResultKind).toBe("NOT_PLAYED");
    expect(a.includedInDatum).toBe(false);
    expect(a.includedInMatchScore).toBe(false);
    expect(a.adjustmentMode).toBe("cancelled");
  });

  it("builds artificial with score", () => {
    const a = buildArtificialAdjustment({
      adminAdjustedNsScore: 100,
      datumEligible: true,
    });
    expect(a.includedInDatum).toBe(true);
    expect(a.includedInMatchScore).toBe(true);
  });

  it("builds split with independent IMPs", () => {
    const a = buildSplitAdjustment({
      adminNsButlerImps: 3,
      adminEwButlerImps: 1,
    });
    expect(a.adminNsButlerImps).toBe(3);
    expect(a.adminEwButlerImps).toBe(1);
    expect(a.includedInMatchScore).toBe(false);
  });

  it("builds weighted and stores meta", () => {
    const a = buildWeightedAdjustment({
      scoreA: 100,
      weightA: 1,
      scoreB: 0,
      weightB: 1,
    });
    expect(a.adminAdjustedNsScore).toBe(50);
    expect(a.adjustmentMeta?.computedNsScore).toBe(50);
  });
});

describe("Butler split IMPs", () => {
  it("uses independent EW admin IMPs when provided", () => {
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

  it("defaults EW to -NS when only NS admin IMP set", () => {
    const results: ButlerResultInput[] = [
      {
        id: "1",
        nsPairId: "a",
        ewPairId: "b",
        includedInDatum: false,
        nsScoreForDatum: null,
        adminNsButlerImps: 2,
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
    const row = out.results.find((r) => r.id === "1");
    expect(row?.ewButlerImps).toBe(-2);
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
});
