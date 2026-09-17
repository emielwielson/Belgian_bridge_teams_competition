import type { ReceivedDataRow } from "@/lib/bridgemate/types";

function normalizeRow(raw: Record<string, unknown>): ReceivedDataRow {
  const out: ReceivedDataRow = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = v as ReceivedDataRow[string];
  }
  return out;
}

/** Accept a JSON array of ReceivedData rows (CI fixtures / test path). */
export function parseReceivedDataJson(rows: unknown): ReceivedDataRow[] {
  if (!Array.isArray(rows)) {
    throw new Error("ReceivedData moet een JSON-array zijn.");
  }
  return rows.map((r, i) => {
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      throw new Error(`ReceivedData-rij ${i + 1} is ongeldig.`);
    }
    return normalizeRow(r as Record<string, unknown>);
  });
}

export { normalizeRow };
