import type {
  BridgemateMappingContext,
  MapRowResult,
  ReceivedDataRow,
} from "@/lib/bridgemate/types";

function asString(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v).trim();
}

function asInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isInteger(n) ? n : null;
}

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

function sectionKey(section: string | null): string {
  return (section ?? "A").trim().toUpperCase();
}

/**
 * Map one ReceivedData row to match/table/board/pairs via explicit admin mapping.
 * Fails with clear Dutch errors when unmapped (PRD remaining open item).
 */
export function mapReceivedDataRow(
  row: ReceivedDataRow,
  ctx: BridgemateMappingContext,
): MapRowResult {
  const errors: string[] = [];

  const section = asString(rowField(row, "Section")) ?? "A";
  const tableNum = asInt(rowField(row, "Table"));
  const boardNum = asInt(rowField(row, "Board"));
  const pairNs = asInt(rowField(row, "PairNS"));
  const pairEw = asInt(rowField(row, "PairEW"));
  const rowRound = asInt(rowField(row, "Round"));

  if (ctx.expectedBridgemateRound != null && rowRound != null) {
    if (rowRound !== ctx.expectedBridgemateRound) {
      errors.push(
        `Bridgemate-ronde ${rowRound} komt niet overeen met verwachte ronde ${ctx.expectedBridgemateRound}.`,
      );
    }
  }

  if (tableNum == null) {
    errors.push("Tafelnummer ontbreekt in Bridgemate-rij.");
  }
  if (boardNum == null) {
    errors.push("Bordnummer ontbreekt in Bridgemate-rij.");
  }

  if (errors.length) return { ok: false, errors };

  const wantSection = sectionKey(section);
  const table = ctx.tables.find(
    (t) =>
      sectionKey(t.bridgemateSection) === wantSection &&
      t.bridgemateTable === tableNum,
  );

  if (!table) {
    return {
      ok: false,
      errors: [
        `Geen tafel gevonden voor sectie ${wantSection} tafel ${tableNum}. Koppel Bridgemate-sectie/tafel in het schema.`,
      ],
    };
  }

  const board = ctx.boards.find((b) => b.boardNumber === boardNum);
  if (!board) {
    return {
      ok: false,
      errors: [
        `Geen bord gevonden voor bordnummer ${boardNum} in deze ronde. Upload eerst de PBN-borden.`,
      ],
    };
  }

  let nsPairId = table.nsPairId;
  let ewPairId = table.ewPairId;

  if (pairNs != null) {
    const pair = ctx.pairs.find((p) => p.bridgematePairNumber === pairNs);
    if (!pair) {
      errors.push(
        `PairNS ${pairNs} is niet gekoppeld. Stel Bridgemate-paarnummer in bij het paar.`,
      );
    } else if (table.nsPairId && pair.id !== table.nsPairId) {
      errors.push(
        `PairNS ${pairNs} komt niet overeen met het NS-paar van sectie ${wantSection} tafel ${tableNum}.`,
      );
    } else {
      nsPairId = pair.id;
    }
  }

  if (pairEw != null) {
    const pair = ctx.pairs.find((p) => p.bridgematePairNumber === pairEw);
    if (!pair) {
      errors.push(
        `PairEW ${pairEw} is niet gekoppeld. Stel Bridgemate-paarnummer in bij het paar.`,
      );
    } else if (table.ewPairId && pair.id !== table.ewPairId) {
      errors.push(
        `PairEW ${pairEw} komt niet overeen met het OW-paar van sectie ${wantSection} tafel ${tableNum}.`,
      );
    } else {
      ewPairId = pair.id;
    }
  }

  if (!nsPairId && pairNs == null) {
    errors.push(
      `NS-paar ontbreekt voor sectie ${wantSection} tafel ${tableNum}.`,
    );
  }
  if (!ewPairId && pairEw == null) {
    errors.push(
      `OW-paar ontbreekt voor sectie ${wantSection} tafel ${tableNum}.`,
    );
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    mapped: {
      matchId: table.matchId,
      tableId: table.id,
      boardId: board.id,
      nsPairId,
      ewPairId,
    },
  };
}
