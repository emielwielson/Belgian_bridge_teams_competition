import { decodeReceivedDataContract } from "@/lib/bridgemate/contract";
import { mapReceivedDataRow } from "@/lib/bridgemate/mapping";
import type {
  BridgemateMappingContext,
  ReceivedDataRow,
} from "@/lib/bridgemate/types";
import type { NormalizedBoardResultInput } from "@/lib/results/types";

export type AdaptRowOk = {
  ok: true;
  index: number;
  row: NormalizedBoardResultInput;
};

export type AdaptRowErr = {
  ok: false;
  index: number;
  errors: string[];
  originalPayload: Record<string, unknown>;
};

export type AdaptResult = {
  rows: NormalizedBoardResultInput[];
  outcomes: Array<AdaptRowOk | AdaptRowErr>;
  mappedCount: number;
  failedCount: number;
};

function snapshotRow(row: ReceivedDataRow): Record<string, unknown> {
  return { ...row };
}

function sourceId(row: ReceivedDataRow, index: number): string {
  const section = row.Section ?? row.section ?? "?";
  const table = row.Table ?? row.table ?? "?";
  const board = row.Board ?? row.board ?? "?";
  const round = row.Round ?? row.round ?? "?";
  return `bm:${String(section)}-${String(table)}-r${String(round)}-b${String(board)}#${index}`;
}

/** Normalize Bridgemate LeadCard to a trimmed string, or null if absent. */
export function extractLeadCard(row: ReceivedDataRow): string | null {
  const raw = row.LeadCard ?? row.leadCard;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

/**
 * Adapt Bridgemate ReceivedData rows to NormalizedBoardResultInput.
 * Isolated from Butler — only maps/normalizes.
 */
export function adaptReceivedDataToNormalized(
  rows: ReceivedDataRow[],
  ctx: BridgemateMappingContext,
): AdaptResult {
  const outcomes: Array<AdaptRowOk | AdaptRowErr> = [];
  const normalized: NormalizedBoardResultInput[] = [];

  for (let index = 0; index < rows.length; index++) {
    const raw = rows[index];
    const originalPayload = snapshotRow(raw);
    const mapped = mapReceivedDataRow(raw, ctx);
    if (!mapped.ok) {
      outcomes.push({
        ok: false,
        index,
        errors: mapped.errors,
        originalPayload,
      });
      continue;
    }

    const decoded = decodeReceivedDataContract(raw);
    const input: NormalizedBoardResultInput = {
      matchId: mapped.mapped.matchId,
      tableId: mapped.mapped.tableId,
      boardId: mapped.mapped.boardId,
      nsPairId: mapped.mapped.nsPairId,
      ewPairId: mapped.mapped.ewPairId,
      contractLevel: decoded.contractLevel,
      contractDenomination: decoded.contractDenomination,
      doubling: decoded.doubling,
      declarer: decoded.declarer,
      tricksResult: decoded.tricksResult,
      tricksTaken: decoded.tricksTaken,
      leadCard: extractLeadCard(raw),
      bridgemateScore: decoded.bridgemateScore,
      specialResultKind: decoded.specialResultKind,
      remarks: decoded.remarks,
      resolvedAdjustment: decoded.resolvedAdjustment,
      sourceIdentifier: sourceId(raw, index),
      originalPayload,
    };
    normalized.push(input);
    outcomes.push({ ok: true, index, row: input });
  }

  return {
    rows: normalized,
    outcomes,
    mappedCount: normalized.length,
    failedCount: outcomes.filter((o) => !o.ok).length,
  };
}
