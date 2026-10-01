/**
 * Collapse Bridgemate ReceivedData corrections within a single .bws file.
 *
 * BCS score corrections write a 3-row pattern per board:
 * 1. original (Erased=false)
 * 2. erase echo (Erased=true, Remarks="Result erased")
 * 3. corrected (Erased=false, later TimeLog)
 *
 * We keep the latest non-erased row and flag Bridgemate corrections for audit.
 */

import type { ReceivedDataRow } from "@/lib/bridgemate/types";

export type BridgemateCorrectionInfo = {
  previousPayload: Record<string, unknown>;
  supersededCount: number;
};

export type DedupeReceivedResult = {
  /** Rows to ingest (one per Section|Table|Round|Board). */
  rows: ReceivedDataRow[];
  /** Correction metadata keyed by {@link receivedDataGroupKey}. */
  correctionsByKey: Map<string, BridgemateCorrectionInfo>;
  /** How many raw rows were dropped as superseded / erase-echoes. */
  droppedCount: number;
};

function rowField(row: ReceivedDataRow, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return row[k];
    const found = Object.keys(row).find(
      (rk) => rk.toLowerCase() === k.toLowerCase(),
    );
    if (found && row[found] != null && row[found] !== "") return row[found];
  }
  return null;
}

function truthyFlag(v: unknown): boolean {
  if (v === true || v === 1 || v === "1" || v === -1) return true;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "true" || t === "yes" || t === "y";
  }
  return false;
}

function asString(v: unknown): string {
  if (v == null) return "?";
  if (typeof v === "string") return v.trim() || "?";
  return String(v);
}

/** Stable group key for one board result in ReceivedData. */
export function receivedDataGroupKey(row: ReceivedDataRow): string {
  return [
    asString(rowField(row, "Section")),
    asString(rowField(row, "Table")),
    asString(rowField(row, "Round")),
    asString(rowField(row, "Board")),
  ].join("|");
}

function isErased(row: ReceivedDataRow): boolean {
  return truthyFlag(rowField(row, "Erased"));
}

/**
 * Parse Bridgemate DateLog / TimeLog into a comparable epoch ms.
 * TimeLog often uses Access epoch date 1899-12-30 with a wall-clock time.
 */
export function receivedDataTimestampMs(row: ReceivedDataRow): number | null {
  const timeRaw = rowField(row, "TimeLog");
  const dateRaw = rowField(row, "DateLog");

  const timeMs = toEpochMs(timeRaw);
  const dateMs = toEpochMs(dateRaw);

  if (timeMs != null && dateMs != null) {
    const time = new Date(timeMs);
    const date = new Date(dateMs);
    // Combine date (Y-M-D) with time-of-day from TimeLog.
    const combined = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      time.getUTCHours(),
      time.getUTCMinutes(),
      time.getUTCSeconds(),
      time.getUTCMilliseconds(),
    );
    return combined;
  }
  if (timeMs != null) return timeMs;
  if (dateMs != null) return dateMs;
  return null;
}

function toEpochMs(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.getTime();
  if (typeof v === "number" && Number.isFinite(v)) {
    // Access OLE date serial (~days since 1899-12-30) is uncommon here;
    // treat large numbers as already-ms.
    if (v > 1e11) return v;
    return null;
  }
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function rowId(row: ReceivedDataRow): number | null {
  const raw = rowField(row, "ID", "Id");
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

type IndexedRow = { index: number; row: ReceivedDataRow };

function compareRecency(a: IndexedRow, b: IndexedRow): number {
  const ta = receivedDataTimestampMs(a.row);
  const tb = receivedDataTimestampMs(b.row);
  if (ta != null && tb != null && ta !== tb) return ta - tb;
  if (ta != null && tb == null) return 1;
  if (ta == null && tb != null) return -1;

  const ida = rowId(a.row);
  const idb = rowId(b.row);
  if (ida != null && idb != null && ida !== idb) return ida - idb;

  return a.index - b.index;
}

function snapshot(row: ReceivedDataRow): Record<string, unknown> {
  return { ...row };
}

/**
 * Deduplicate ReceivedData: one kept row per board key, preferring latest
 * non-erased result. Emits Bridgemate correction metadata when an earlier
 * score was superseded.
 */
export function dedupeReceivedData(
  rows: ReceivedDataRow[],
): DedupeReceivedResult {
  const groups = new Map<string, IndexedRow[]>();
  rows.forEach((row, index) => {
    const key = receivedDataGroupKey(row);
    const list = groups.get(key);
    if (list) list.push({ index, row });
    else groups.set(key, [{ index, row }]);
  });

  const kept: IndexedRow[] = [];
  const correctionsByKey = new Map<string, BridgemateCorrectionInfo>();
  let droppedCount = 0;

  for (const [key, members] of groups) {
    if (members.length === 1) {
      kept.push(members[0]);
      continue;
    }

    const nonErased = members.filter((m) => !isErased(m.row));
    const erased = members.filter((m) => isErased(m.row));

    // Prefer non-erased; only fall back to erased if nothing else exists.
    const candidates = nonErased.length > 0 ? nonErased : erased;
    const sorted = [...candidates].sort(compareRecency);
    const winner = sorted[sorted.length - 1];
    kept.push(winner);
    droppedCount += members.length - 1;

    // Correction when BCS wrote a replacement (erase echo and/or multiple live rows).
    const isCorrection =
      nonErased.length >= 2 ||
      (nonErased.length >= 1 && erased.length >= 1);

    if (isCorrection && nonErased.length >= 1) {
      const originals = [...nonErased].sort(compareRecency);
      const previous = originals[0];
      // Don't flag if the only non-erased is identical to winner and no erase
      // (shouldn't happen with length>=2). Always record previous = earliest.
      if (previous.index !== winner.index || erased.length >= 1) {
        correctionsByKey.set(key, {
          previousPayload: snapshot(previous.row),
          supersededCount: members.length - 1,
        });
      }
    }
  }

  kept.sort((a, b) => a.index - b.index);

  return {
    rows: kept.map((k) => k.row),
    correctionsByKey,
    droppedCount,
  };
}

/** Snapshot fields useful for adjustment_meta.previous from a ReceivedData row. */
export function previousFieldsFromReceivedPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    Contract: payload.Contract ?? payload.contract ?? null,
    Result: payload.Result ?? payload.result ?? null,
    Declarer: payload.Declarer ?? payload.declarer ?? null,
    "NS/EW": payload["NS/EW"] ?? payload.NSEW ?? null,
    LeadCard: payload.LeadCard ?? payload.leadCard ?? null,
    Remarks: payload.Remarks ?? payload.remarks ?? null,
    ScoreNS: payload.ScoreNS ?? payload.NSScore ?? null,
    Erased: payload.Erased ?? null,
    DateLog: payload.DateLog ?? null,
    TimeLog: payload.TimeLog ?? null,
  };
}
