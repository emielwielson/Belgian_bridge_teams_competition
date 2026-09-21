import type {
  ContractDenomination,
  Declarer,
  Doubling,
  SpecialResultKind,
} from "@/lib/boards/types";

/**
 * Normalized board-result row — shape Task 5 Bridgemate adapter will emit.
 */
export type NormalizedBoardResultInput = {
  matchId: string;
  tableId: string;
  boardId: string;
  nsPairId?: string | null;
  ewPairId?: string | null;
  contractLevel?: number | null;
  contractDenomination?: ContractDenomination | null;
  doubling?: Doubling;
  declarer?: Declarer | null;
  tricksResult?: string | null;
  tricksTaken?: number | null;
  /** Opening lead card from Bridgemate (e.g. SA, HK) */
  leadCard?: string | null;
  /** Score from Bridgemate (NS perspective), when supplied */
  bridgemateScore?: number | null;
  specialResultKind?: SpecialResultKind;
  /** Bridgemate Remarks — % arbitral must not be silently converted */
  remarks?: string | null;
  sourceIdentifier?: string | null;
  /** Frozen snapshot of the source row */
  originalPayload: Record<string, unknown>;
};

export type ResultValidationIssue = {
  code: string;
  message: string;
};

export type CorrectionInput = {
  contractLevel?: number | null;
  contractDenomination?: ContractDenomination | null;
  doubling?: Doubling;
  declarer?: Declarer | null;
  tricksResult?: string | null;
  tricksTaken?: number | null;
  nsScore?: number | null;
  reason?: string | null;
};

export type AdjustmentMode =
  | "cancelled"
  | "artificial"
  | "split"
  | "weighted"
  | "average_pm"
  | "correction";

/** Assigned average +/− on one side of a table (A+/A−, G+/G−). */
export type AverageAward = "plus" | "minus";

export type ResolveSpecialInput = {
  specialResultKind: SpecialResultKind;
  adminAdjustedNsScore?: number | null;
  /** EW-favorable table points for Butler datum (positive = good for EW). */
  adminAdjustedEwScore?: number | null;
  adminNsButlerImps?: number | null;
  adminEwButlerImps?: number | null;
  /** When true, adjusted raw score may enter the datum set */
  datumEligible?: boolean | null;
  includedInMatchScore?: boolean | null;
  adjustmentMode?: AdjustmentMode | null;
  adjustmentMeta?: Record<string, unknown> | null;
  reason?: string | null;
};

/** One possible contract/score with separate NS and EW weights. */
export type WeightedScoreLeg = {
  score: number;
  weightNs: number;
  weightEw: number;
};

export type WeightedScoresInput = {
  legs: WeightedScoreLeg[];
};

/** @deprecated Use WeightedScoresInput / WeightedScoreLeg. */
export type WeightedScoreInput = {
  scoreA: number;
  weightA: number;
  scoreB: number;
  weightB: number;
};
