import { describe, expect, it } from "vitest";
import {
  decodeReceivedDataContract,
  detectBridgemateSpecial,
  parseAveragePmFromText,
} from "./contract";
import { validateNormalizedResult } from "@/lib/results/validation";
import type { NormalizedBoardResultInput } from "@/lib/results/types";

describe("parseAveragePmFromText", () => {
  it("parses Bridgemate percentage pairs", () => {
    expect(parseAveragePmFromText("60%-40%")).toEqual({
      nsAward: "plus",
      ewAward: "minus",
    });
    expect(parseAveragePmFromText("40%/60%")).toEqual({
      nsAward: "minus",
      ewAward: "plus",
    });
    expect(parseAveragePmFromText("60%–40%")).toEqual({
      nsAward: "plus",
      ewAward: "minus",
    });
    expect(parseAveragePmFromText("60% - 50%")).toEqual({
      nsAward: "plus",
      ewAward: "zero",
    });
  });

  it("parses flat 50%-50% as zero awards and rejects invalid percentages", () => {
    expect(parseAveragePmFromText("50%-50%")).toEqual({
      nsAward: "zero",
      ewAward: "zero",
    });
    expect(parseAveragePmFromText("55%-45%")).toBeNull();
  });

  it("parses locale G± / A± / M± pairs and singles including plain G", () => {
    expect(parseAveragePmFromText("G+/G-")).toEqual({
      nsAward: "plus",
      ewAward: "minus",
    });
    expect(parseAveragePmFromText("A-/A+")).toEqual({
      nsAward: "minus",
      ewAward: "plus",
    });
    expect(parseAveragePmFromText("G+")).toEqual({
      nsAward: "plus",
      ewAward: null,
    });
    expect(parseAveragePmFromText("G")).toEqual({
      nsAward: "zero",
      ewAward: null,
    });
    expect(parseAveragePmFromText("G/G")).toEqual({
      nsAward: "zero",
      ewAward: "zero",
    });
    expect(parseAveragePmFromText("A/A+")).toEqual({
      nsAward: "zero",
      ewAward: "plus",
    });
  });
});

describe("detectBridgemateSpecial", () => {
  it("auto-resolves not played / NG / Niet gespeeld to cancelled", () => {
    for (const remarks of ["Not played", "Niet gespeeld", "NG", "np"]) {
      const d = detectBridgemateSpecial({
        remarks,
        erased: false,
        contract: null,
      });
      expect(d.specialResultKind).toBe("NOT_PLAYED");
      expect(d.resolvedAdjustment?.adjustmentMode).toBe("cancelled");
    }
  });

  it("does not treat remarks containing np as substring as not played", () => {
    const d = detectBridgemateSpecial({
      remarks: "input",
      erased: false,
      contract: null,
    });
    expect(d.specialResultKind).not.toBe("NOT_PLAYED");
    expect(d.resolvedAdjustment).toBeNull();
  });

  it("auto-resolves 60%-40% and G+/G- to average_pm", () => {
    const pct = detectBridgemateSpecial({
      remarks: "60%-40%",
      erased: false,
      contract: null,
    });
    expect(pct.specialResultKind).toBe("ADJUSTED");
    expect(pct.resolvedAdjustment?.adjustmentMode).toBe("average_pm");
    expect(pct.resolvedAdjustment?.adjustmentMeta).toMatchObject({
      nsAward: "plus",
      ewAward: "minus",
    });

    const labels = detectBridgemateSpecial({
      remarks: "G+/G-",
      erased: false,
      contract: null,
    });
    expect(labels.resolvedAdjustment?.adjustmentMode).toBe("average_pm");
  });

  it("auto-resolves Contract G+ to average_pm NS plus", () => {
    const d = detectBridgemateSpecial({
      remarks: null,
      erased: false,
      contract: "G+",
    });
    expect(d.specialResultKind).toBe("ADJUSTED");
    expect(d.resolvedAdjustment?.adjustmentMeta).toMatchObject({
      nsAward: "plus",
      ewAward: null,
    });
  });

  it("auto-resolves bare G and 50%-50% to average_pm zero", () => {
    const g = detectBridgemateSpecial({
      remarks: null,
      erased: false,
      contract: "G",
    });
    expect(g.specialResultKind).toBe("ADJUSTED");
    expect(g.resolvedAdjustment?.adjustmentMode).toBe("average_pm");
    expect(g.resolvedAdjustment?.adjustmentMeta).toMatchObject({
      nsAward: "zero",
      ewAward: null,
    });

    const flat = detectBridgemateSpecial({
      remarks: "50%-50%",
      erased: false,
      contract: null,
    });
    expect(flat.specialResultKind).toBe("ADJUSTED");
    expect(flat.resolvedAdjustment?.adjustmentMeta).toMatchObject({
      nsAward: "zero",
      ewAward: "zero",
    });
  });

  it("leaves undecided arbitral and odd percentages for admin", () => {
    for (const remarks of ["Arbitral score", "55%-45%"]) {
      const d = detectBridgemateSpecial({
        remarks,
        erased: false,
        contract: null,
      });
      expect(d.specialResultKind).toBe("ARBITRAL");
      expect(d.resolvedAdjustment).toBeNull();
    }
  });
});

describe("decodeReceivedDataContract", () => {
  it("decodes normal contracts unchanged", () => {
    const d = decodeReceivedDataContract({
      Contract: "4HX",
      Result: "+1",
      Declarer: "N",
      ScoreNS: 990,
    });
    expect(d.contractLevel).toBe(4);
    expect(d.contractDenomination).toBe("HEARTS");
    expect(d.doubling).toBe("DOUBLED");
    expect(d.specialResultKind).toBe("NONE");
    expect(d.resolvedAdjustment).toBeNull();
  });

  it("clears contract fields for NG and average_pm rows", () => {
    const ng = decodeReceivedDataContract({
      Contract: "",
      Remarks: "Not played",
    });
    expect(ng.specialResultKind).toBe("NOT_PLAYED");
    expect(ng.contractDenomination).toBeNull();
    expect(ng.resolvedAdjustment?.adjustmentMode).toBe("cancelled");

    const gp = decodeReceivedDataContract({
      Contract: "G+",
      Remarks: "",
    });
    expect(gp.contractDenomination).toBeNull();
    expect(gp.resolvedAdjustment?.adjustmentMode).toBe("average_pm");
  });
});

describe("validateNormalizedResult with resolvedAdjustment", () => {
  const ctx = {
    matchId: "m1",
    tableId: "m1:open",
    tableMatchId: "m1",
    boardId: "b1",
    boardTournamentRound: 1,
    matchTournamentRound: 1,
    boardVulnerability: "NONE" as const,
    existingResultForTableBoard: false,
    tableNsPairId: "p1",
    tableEwPairId: "p2",
  };

  function base(
    overrides: Partial<NormalizedBoardResultInput>,
  ): NormalizedBoardResultInput {
    return {
      matchId: "m1",
      tableId: "m1:open",
      boardId: "b1",
      originalPayload: {},
      ...overrides,
    };
  }

  it("marks auto-resolved NG as valid without admin", () => {
    const decoded = decodeReceivedDataContract({ Remarks: "NG" });
    const v = validateNormalizedResult(
      base({
        specialResultKind: decoded.specialResultKind,
        remarks: decoded.remarks,
        resolvedAdjustment: decoded.resolvedAdjustment,
      }),
      ctx,
    );
    expect(v.validationStatus).toBe("VALID");
    expect(v.requiresAdminResolution).toBe(false);
    expect(v.includedInDatum).toBe(false);
    expect(v.specialResultKind).toBe("NOT_PLAYED");
  });

  it("marks auto-resolved 60%-40% as valid average_pm", () => {
    const decoded = decodeReceivedDataContract({ Remarks: "60%-40%" });
    const v = validateNormalizedResult(
      base({
        specialResultKind: decoded.specialResultKind,
        remarks: decoded.remarks,
        resolvedAdjustment: decoded.resolvedAdjustment,
      }),
      ctx,
    );
    expect(v.validationStatus).toBe("VALID");
    expect(v.requiresAdminResolution).toBe(false);
    expect(v.specialResultKind).toBe("ADJUSTED");
    expect(v.includedInDatum).toBe(false);
  });

  it("still requires admin for undecided arbitral remarks", () => {
    const decoded = decodeReceivedDataContract({ Remarks: "Arbitral score" });
    const v = validateNormalizedResult(
      base({
        specialResultKind: decoded.specialResultKind,
        remarks: decoded.remarks,
        resolvedAdjustment: decoded.resolvedAdjustment,
      }),
      ctx,
    );
    expect(v.validationStatus).toBe("SPECIAL");
    expect(v.requiresAdminResolution).toBe(true);
  });
});
