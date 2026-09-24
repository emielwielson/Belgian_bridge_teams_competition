/**
 * Pure helpers for arbiter board-result adjustments.
 */

import type {
  AdjustmentMode,
  AverageAward,
  NonOffendingSide,
  WeightedMatchImpsOverride,
  WeightedScoreLeg,
  WeightedScoresInput,
  WeightedAdjustmentInput,
} from "@/lib/results/types";
import type { SpecialResultKind } from "@/lib/boards/types";

export type {
  AverageAward,
  NonOffendingSide,
  WeightedMatchImpsOverride,
};

export function computeWeightedSideScore(
  legs: readonly WeightedScoreLeg[],
  side: "ns" | "ew",
): number {
  if (legs.length < 2) {
    throw new Error("Gewogen score vereist minstens twee scores.");
  }
  let weightedSum = 0;
  let weightSum = 0;
  for (const leg of legs) {
    const w = side === "ns" ? leg.weightNs : leg.weightEw;
    if (!(w > 0)) {
      throw new Error("Gewichten moeten groter dan 0 zijn.");
    }
    if (!Number.isFinite(leg.score)) {
      throw new Error("Ongeldige score in gewogen resultaat.");
    }
    weightedSum += leg.score * w;
    weightSum += w;
  }
  return weightedSum / weightSum;
}

export function roundWeightedSideScore(
  legs: readonly WeightedScoreLeg[],
  side: "ns" | "ew",
): number {
  return Math.round(computeWeightedSideScore(legs, side));
}

export function computeWeightedScores(input: WeightedScoresInput): {
  computedNs: number;
  computedEw: number;
} {
  return {
    computedNs: roundWeightedSideScore(input.legs, "ns"),
    computedEw: roundWeightedSideScore(input.legs, "ew"),
  };
}

export type BuiltAdjustment = {
  specialResultKind: SpecialResultKind;
  adminAdjustedNsScore: number | null;
  adminAdjustedEwScore: number | null;
  adminNsButlerImps: number | null;
  adminEwButlerImps: number | null;
  datumEligible: boolean | null;
  includedInDatum: boolean;
  includedInMatchScore: boolean;
  adjustmentMode: AdjustmentMode;
  adjustmentMeta: Record<string, unknown> | null;
};

export function buildCancelledAdjustment(meta?: {
  reason?: string | null;
}): BuiltAdjustment {
  return {
    specialResultKind: "NOT_PLAYED",
    adminAdjustedNsScore: null,
    adminAdjustedEwScore: null,
    adminNsButlerImps: null,
    adminEwButlerImps: null,
    datumEligible: false,
    includedInDatum: false,
    includedInMatchScore: false,
    adjustmentMode: "cancelled",
    adjustmentMeta: meta?.reason ? { reason: meta.reason } : null,
  };
}

export function buildSplitAdjustment(input: {
  adminAdjustedNsScore: number;
  adminAdjustedEwScore: number;
  datumEligible?: boolean | null;
  reason?: string | null;
}): BuiltAdjustment {
  if (
    !Number.isFinite(input.adminAdjustedNsScore) ||
    !Number.isFinite(input.adminAdjustedEwScore)
  ) {
    throw new Error("Split-scores vereisen NS- en OW-datumscores.");
  }
  const datumEligible = input.datumEligible ?? true;
  return {
    specialResultKind: "ADJUSTED",
    adminAdjustedNsScore: input.adminAdjustedNsScore,
    adminAdjustedEwScore: input.adminAdjustedEwScore,
    adminNsButlerImps: null,
    adminEwButlerImps: null,
    datumEligible,
    includedInDatum: datumEligible,
    includedInMatchScore: true,
    adjustmentMode: "split",
    adjustmentMeta: {
      reason: input.reason ?? null,
      adminAdjustedNsScore: input.adminAdjustedNsScore,
      adminAdjustedEwScore: input.adminAdjustedEwScore,
    },
  };
}

export function buildWeightedAdjustment(
  input: WeightedAdjustmentInput & {
    datumEligible?: boolean | null;
    reason?: string | null;
  },
): BuiltAdjustment {
  if (input.nonOffendingSide !== "ns" && input.nonOffendingSide !== "ew") {
    throw new Error(
      "Gewogen score vereist een niet-overtredende partij (NZ of OW).",
    );
  }
  const override = input.matchImpsOverride ?? null;
  if (override != null) {
    if (
      !Number.isInteger(override.homeImps) ||
      !Number.isInteger(override.awayImps)
    ) {
      throw new Error(
        "Handmatige wedstrijd-IMP’s moeten gehele getallen zijn.",
      );
    }
  }
  const { computedNs, computedEw } = computeWeightedScores(input);
  const datumEligible = input.datumEligible ?? true;
  return {
    specialResultKind: "ADJUSTED",
    adminAdjustedNsScore: computedNs,
    adminAdjustedEwScore: computedEw,
    adminNsButlerImps: null,
    adminEwButlerImps: null,
    datumEligible,
    includedInDatum: datumEligible,
    includedInMatchScore: true,
    adjustmentMode: "weighted",
    adjustmentMeta: {
      reason: input.reason ?? null,
      legs: input.legs,
      computedNsScore: computedNs,
      computedEwScore: computedEw,
      nonOffendingSide: input.nonOffendingSide,
      matchImpsOverride: override,
    },
  };
}

function isAverageAward(value: unknown): value is AverageAward {
  return value === "plus" || value === "minus" || value === "zero";
}

/**
 * Assigned average award (A+/A/A−). Excluded from Butler datum; match IMPs use
 * ±3 for plus/minus and 0 for zero. Butler IMPs are computed at recalc time
 * from the combination's round average (zero → 0).
 */
export function buildAveragePmAdjustment(input: {
  nsAward?: AverageAward | null;
  ewAward?: AverageAward | null;
  reason?: string | null;
}): BuiltAdjustment {
  const nsAward = input.nsAward ?? null;
  const ewAward = input.ewAward ?? null;
  if (nsAward != null && !isAverageAward(nsAward)) {
    throw new Error("Ongeldige NZ-toekenning voor gemiddelde +/-.");
  }
  if (ewAward != null && !isAverageAward(ewAward)) {
    throw new Error("Ongeldige OW-toekenning voor gemiddelde +/-.");
  }
  if (nsAward == null && ewAward == null) {
    throw new Error("Gemiddelde +/- vereist minstens één toekenning (NZ of OW).");
  }
  return {
    specialResultKind: "ADJUSTED",
    adminAdjustedNsScore: null,
    adminAdjustedEwScore: null,
    adminNsButlerImps: null,
    adminEwButlerImps: null,
    datumEligible: false,
    includedInDatum: false,
    includedInMatchScore: true,
    adjustmentMode: "average_pm",
    adjustmentMeta: {
      reason: input.reason ?? null,
      nsAward,
      ewAward,
    },
  };
}

/** Read NS/EW average awards from adjustment_meta (null if absent/invalid). */
export function parseAveragePmAwards(
  meta: Record<string, unknown> | null | undefined,
): { nsAward: AverageAward | null; ewAward: AverageAward | null } {
  if (!meta || typeof meta !== "object") {
    return { nsAward: null, ewAward: null };
  }
  return {
    nsAward: isAverageAward(meta.nsAward) ? meta.nsAward : null,
    ewAward: isAverageAward(meta.ewAward) ? meta.ewAward : null,
  };
}

export function hasAveragePmAward(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  const { nsAward, ewAward } = parseAveragePmAwards(meta);
  return nsAward != null || ewAward != null;
}
