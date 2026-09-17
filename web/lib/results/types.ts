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

export type ResolveSpecialInput = {
  specialResultKind: SpecialResultKind;
  adminAdjustedNsScore?: number | null;
  adminNsButlerImps?: number | null;
  /** When true, adjusted raw score may enter the datum set */
  datumEligible?: boolean | null;
  reason?: string | null;
};
