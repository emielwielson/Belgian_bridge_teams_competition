/**
 * Pure helpers for arbiter board-result adjustments.
 */

import type {
  AdjustmentMode,
  WeightedScoreLeg,
  WeightedScoresInput,
} from "@/lib/results/types";
import type { SpecialResultKind } from "@/lib/boards/types";

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
  input: WeightedScoresInput & {
    datumEligible?: boolean | null;
    reason?: string | null;
  },
): BuiltAdjustment {
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
    },
  };
}
