import type { ReceivedDataRow } from "@/lib/bridgemate/types";
import { normalizeRow } from "@/lib/bridgemate/parse-received";

function asInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isInteger(n) ? n : null;
}

function asLetter(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim().toUpperCase();
  return s.length ? s : null;
}

/**
 * ReceivedData.Section is the numeric Section.ID (BMdevguide). Map 1 → "A"
 * via the Section table. Rows that already have a letter are left unchanged
 * (JSON fixtures / some exports).
 */
export function mapSectionIdsToLetters(
  rows: ReceivedDataRow[],
  sectionTable: Array<Record<string, unknown>>,
): ReceivedDataRow[] {
  const idToLetter = new Map<number, string>();
  for (const section of sectionTable) {
    const id = asInt(section.ID ?? section.Id);
    const letter = asLetter(section.Letter ?? section.letter);
    if (id != null && letter) idToLetter.set(id, letter);
  }
  if (!idToLetter.size) return rows;

  return rows.map((row) => {
    const raw = row.Section;
    if (raw == null || raw === "") return row;
    if (typeof raw === "string" && /[A-Za-z]/.test(raw)) return row;
    const id = asInt(raw);
    if (id == null) return row;
    const letter = idToLetter.get(id);
    if (!letter) return row;
    return { ...row, Section: letter };
  });
}

/**
 * Read ReceivedData from a Bridgemate `.bws` Access database buffer.
 * BiddingData / PlayData are ignored.
 * Uses dynamic import so Jest unit tests need not load ESM mdb-reader.
 */
export async function parseBwsBuffer(buffer: Buffer): Promise<ReceivedDataRow[]> {
  let MDBReader: new (buffer: Buffer) => {
    getTableNames: () => string[];
    getTable: (name: string) => { getData: () => Record<string, unknown>[] };
  };
  try {
    const mod = await import("mdb-reader");
    MDBReader = mod.default;
  } catch {
    throw new Error(
      "Bridgemate-parser (mdb-reader) kon niet worden geladen op deze server.",
    );
  }

  let reader: InstanceType<typeof MDBReader>;
  try {
    reader = new MDBReader(buffer);
  } catch {
    throw new Error(
      "Bridgemate-bestand kon niet worden gelezen. Controleer of het een geldig .bws (Access) bestand is.",
    );
  }

  const names = reader.getTableNames();
  const receivedName = names.find(
    (n) => n.toLowerCase() === "receiveddata",
  );
  if (!receivedName) {
    throw new Error(
      "Tabel ReceivedData ontbreekt in het .bws-bestand. BiddingData en PlayData worden niet gebruikt.",
    );
  }

  try {
    const table = reader.getTable(receivedName);
    const data = table.getData();
    let sectionTable: Array<Record<string, unknown>> = [];
    const sectionName = names.find((n) => n.toLowerCase() === "section");
    if (sectionName) {
      try {
        sectionTable = reader.getTable(sectionName).getData();
      } catch {
        sectionTable = [];
      }
    }
    return mapSectionIdsToLetters(data.map(normalizeRow), sectionTable);
  } catch {
    throw new Error("ReceivedData kon niet worden uitgelezen uit het .bws-bestand.");
  }
}
