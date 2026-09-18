/**
 * Pure helpers for arbiter board-result adjustments.
 */

import type { AdjustmentMode, WeightedScoreInput } from "@/lib/results/types";
import type { SpecialResultKind } from "@/lib/boards/types";

export function computeWeightedNsScore(input: WeightedScoreInput): number {
  const { scoreA, weightA, scoreB, weightB } = input;
  if (!(weightA > 0) || !(weightB > 0)) {
    throw new Error("Gewichten moeten groter dan 0 zijn.");
  }
  const total = weightA + weightB;
  return (weightA * scoreA + weightB * scoreB) / total;
}

/** Round to nearest integer (bridge scores are whole points). */
export function roundWeightedNsScore(input: WeightedScoreInput): number {
  return Math.round(computeWeightedNsScore(input));
}

export type BuiltAdjustment = {
  specialResultKind: SpecialResultKind;
  adminAdjustedNsScore: number | null;
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
    adminNsButlerImps: null,
    adminEwButlerImps: null,
    datumEligible: false,
    includedInDatum: false,
    includedInMatchScore: false,
    adjustmentMode: "cancelled",
    adjustmentMeta: meta?.reason ? { reason: meta.reason } : null,
  };
}

export function buildArtificialAdjustment(input: {
  adminAdjustedNsScore?: number | null;
  adminNsButlerImps?: number | null;
  adminEwButlerImps?: number | null;
  datumEligible?: boolean | null;
  reason?: string | null;
}): BuiltAdjustment {
  const hasScore = input.adminAdjustedNsScore != null;
  const hasImps =
    input.adminNsButlerImps != null || input.adminEwButlerImps != null;
  if (!hasScore && !hasImps) {
    throw new Error(
      "Voer een aangepaste NS-score en/of Butler-IMP(s) in voor een arbitrale score.",
    );
  }
  if (input.datumEligible === true && !hasScore) {
    throw new Error(
      "Voor datum-geschiktheid is een aangepaste NS-score verplicht.",
    );
  }
  return {
    specialResultKind: "ADJUSTED",
    adminAdjustedNsScore: input.adminAdjustedNsScore ?? null,
    adminNsButlerImps: input.adminNsButlerImps ?? null,
    adminEwButlerImps: input.adminEwButlerImps ?? null,
    datumEligible: input.datumEligible ?? false,
    includedInDatum:
      input.datumEligible === true && input.adminAdjustedNsScore != null,
    includedInMatchScore: hasScore,
    adjustmentMode: "artificial",
    adjustmentMeta: {
      reason: input.reason ?? null,
      adminAdjustedNsScore: input.adminAdjustedNsScore ?? null,
      adminNsButlerImps: input.adminNsButlerImps ?? null,
      adminEwButlerImps: input.adminEwButlerImps ?? null,
    },
  };
}

export function buildSplitAdjustment(input: {
  adminNsButlerImps: number;
  adminEwButlerImps: number;
  adminAdjustedNsScore?: number | null;
  datumEligible?: boolean | null;
  reason?: string | null;
}): BuiltAdjustment {
  if (
    !Number.isFinite(input.adminNsButlerImps) ||
    !Number.isFinite(input.adminEwButlerImps)
  ) {
    throw new Error("Split-scores vereisen NS- en EW-Butler-IMP’s.");
  }
  if (input.datumEligible === true && input.adminAdjustedNsScore == null) {
    throw new Error(
      "Voor datum-geschiktheid is een aangepaste NS-score verplicht.",
    );
  }
  const hasScore = input.adminAdjustedNsScore != null;
  return {
    specialResultKind: "ADJUSTED",
    adminAdjustedNsScore: input.adminAdjustedNsScore ?? null,
    adminNsButlerImps: input.adminNsButlerImps,
    adminEwButlerImps: input.adminEwButlerImps,
    datumEligible: input.datumEligible ?? false,
    includedInDatum:
      input.datumEligible === true && input.adminAdjustedNsScore != null,
    includedInMatchScore: hasScore,
    adjustmentMode: "split",
    adjustmentMeta: {
      reason: input.reason ?? null,
      adminNsButlerImps: input.adminNsButlerImps,
      adminEwButlerImps: input.adminEwButlerImps,
      adminAdjustedNsScore: input.adminAdjustedNsScore ?? null,
    },
  };
}

export function buildWeightedAdjustment(input: WeightedScoreInput & {
  datumEligible?: boolean | null;
  adminNsButlerImps?: number | null;
  adminEwButlerImps?: number | null;
  reason?: string | null;
}): BuiltAdjustment {
  const score = roundWeightedNsScore(input);
  return {
    specialResultKind: "ADJUSTED",
    adminAdjustedNsScore: score,
    adminNsButlerImps: input.adminNsButlerImps ?? null,
    adminEwButlerImps: input.adminEwButlerImps ?? null,
    datumEligible: input.datumEligible ?? true,
    includedInDatum: (input.datumEligible ?? true) === true,
    includedInMatchScore: true,
    adjustmentMode: "weighted",
    adjustmentMeta: {
      reason: input.reason ?? null,
      scoreA: input.scoreA,
      weightA: input.weightA,
      scoreB: input.scoreB,
      weightB: input.weightB,
      computedNsScore: score,
    },
  };
}
