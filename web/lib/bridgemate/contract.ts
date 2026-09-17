import type {
  ContractDenomination,
  Declarer,
  Doubling,
  SpecialResultKind,
} from "@/lib/boards/types";
import type { ReceivedDataRow } from "@/lib/bridgemate/types";

export type DecodedContract = {
  contractLevel: number | null;
  contractDenomination: ContractDenomination | null;
  doubling: Doubling;
  declarer: Declarer | null;
  tricksResult: string | null;
  tricksTaken: number | null;
  bridgemateScore: number | null;
  specialResultKind: SpecialResultKind;
  remarks: string | null;
};

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function asNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function truthyFlag(v: unknown): boolean {
  if (v === true || v === 1 || v === "1") return true;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "true" || t === "yes" || t === "y";
  }
  return false;
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

const DENOM_MAP: Record<string, ContractDenomination> = {
  C: "CLUBS",
  D: "DIAMONDS",
  H: "HEARTS",
  S: "SPADES",
  N: "NT",
  NT: "NT",
  SA: "NT",
};

/**
 * Parse Bridgemate Contract string: PASS, 1S, 3NT, 4HX, 6SXX, 2♣ variants.
 */
export function parseBridgemateContract(raw: string | null): {
  contractLevel: number | null;
  contractDenomination: ContractDenomination | null;
  doubling: Doubling;
} {
  if (!raw || !raw.trim()) {
    return {
      contractLevel: null,
      contractDenomination: null,
      doubling: "NONE",
    };
  }
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (s === "PASS" || s === "PAS" || s === "P") {
    return {
      contractLevel: null,
      contractDenomination: "PASS",
      doubling: "NONE",
    };
  }

  let doubling: Doubling = "NONE";
  let body = s;
  if (body.endsWith("XX")) {
    doubling = "REDOUBLED";
    body = body.slice(0, -2);
  } else if (body.endsWith("X")) {
    doubling = "DOUBLED";
    body = body.slice(0, -1);
  }

  const m = body.match(/^([1-7])(NT|SA|[CDHSN])$/);
  if (!m) {
    return {
      contractLevel: null,
      contractDenomination: null,
      doubling: "NONE",
    };
  }
  const level = Number(m[1]);
  const denom = DENOM_MAP[m[2]];
  if (!denom) {
    return {
      contractLevel: null,
      contractDenomination: null,
      doubling: "NONE",
    };
  }
  return { contractLevel: level, contractDenomination: denom, doubling };
}

export function parseBridgemateDeclarer(
  raw: string | null,
  nsEw: string | null,
): Declarer | null {
  if (raw) {
    const t = raw.trim().toUpperCase();
    if (t === "N" || t === "1") return "N";
    if (t === "E" || t === "2") return "E";
    if (t === "S" || t === "3") return "S";
    if (t === "W" || t === "4") return "W";
  }
  if (nsEw) {
    const t = nsEw.trim().toUpperCase();
    if (t === "N" || t === "NS" || t === "N/S") return "N";
    if (t === "E" || t === "EW" || t === "E/W" || t === "OW") return "E";
    if (t === "S") return "S";
    if (t === "W") return "W";
  }
  return null;
}

export function parseBridgemateResult(raw: string | null): string | null {
  if (raw == null || raw === "") return null;
  const t = raw.trim().toUpperCase();
  if (t === "PASS" || t === "=") return t === "PASS" ? "PASS" : "=";
  if (/^[+-]\d+$/.test(t)) return t;
  // Absolute tricks 0–13 sometimes appear
  const n = Number(t);
  if (Number.isInteger(n) && n >= 0 && n <= 13) {
    return null; // caller may set tricksTaken
  }
  return t;
}

function detectSpecialKind(
  remarks: string | null,
  erased: boolean,
  contract: string | null,
): SpecialResultKind {
  if (erased) return "ERASED";
  if (!remarks) return "NONE";
  const r = remarks.toLowerCase();
  if (
    /\bnot\s*played\b/.test(r) ||
    /\bniet\s*gespeeld\b/.test(r) ||
    r.includes("np")
  ) {
    return "NOT_PLAYED";
  }
  if (
    /arbitral|arbitr|adjusted|aanpass|percentage|procent|%/.test(r)
  ) {
    return "ARBITRAL";
  }
  // Empty contract with remarks often means special
  if (!contract || !contract.trim()) {
    if (r.length > 0) return "ARBITRAL";
  }
  return "NONE";
}

/**
 * Decode one ReceivedData row into domain contract / special fields.
 */
export function decodeReceivedDataContract(row: ReceivedDataRow): DecodedContract {
  const contractRaw = asString(rowField(row, "Contract"));
  const resultRaw = asString(rowField(row, "Result"));
  const declarerRaw = asString(rowField(row, "Declarer"));
  const nsEw = asString(rowField(row, "NS/EW", "NSEW"));
  const remarks = asString(rowField(row, "Remarks"));
  const erased = truthyFlag(rowField(row, "Erased"));
  const scoreNs = asNumber(rowField(row, "ScoreNS", "NSScore"));

  const specialResultKind = detectSpecialKind(remarks, erased, contractRaw);
  const parsed = parseBridgemateContract(contractRaw);
  const declarer =
    parsed.contractDenomination === "PASS"
      ? null
      : parseBridgemateDeclarer(declarerRaw, nsEw);

  let tricksResult = parseBridgemateResult(resultRaw);
  let tricksTaken: number | null = null;
  if (resultRaw != null && tricksResult == null) {
    const n = asNumber(resultRaw);
    if (n != null && n >= 0 && n <= 13) tricksTaken = n;
  }
  if (parsed.contractDenomination === "PASS") {
    tricksResult = "PASS";
  }

  return {
    contractLevel: parsed.contractLevel,
    contractDenomination: parsed.contractDenomination,
    doubling: parsed.doubling,
    declarer,
    tricksResult,
    tricksTaken,
    bridgemateScore: scoreNs,
    specialResultKind,
    remarks,
  };
}
