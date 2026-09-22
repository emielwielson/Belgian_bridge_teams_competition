import type {
  ContractDenomination,
  Declarer,
  Doubling,
  SpecialResultKind,
} from "@/lib/boards/types";
import type { ReceivedDataRow } from "@/lib/bridgemate/types";
import {
  buildAveragePmAdjustment,
  buildCancelledAdjustment,
  type BuiltAdjustment,
} from "@/lib/results/adjustment-helpers";
import type { AverageAward } from "@/lib/results/types";

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
  /** Auto-resolved adjustment when Bridgemate encoding is unambiguous. */
  resolvedAdjustment: BuiltAdjustment | null;
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

/** Map Bridgemate MP percentage to average award; undefined = invalid. */
function mapPercentAward(pct: number): AverageAward | undefined {
  if (pct === 60) return "plus";
  if (pct === 40) return "minus";
  if (pct === 50) return "zero";
  return undefined;
}

/** Parse one average award token (G+, G, A-, Ave, …). undefined = not a label. */
function parseAwardLabel(token: string): AverageAward | undefined {
  const t = token.trim().toUpperCase().replace(/\s+/g, "").replace(/[−–]/g, "-");
  if (!t) return undefined;
  if (
    t === "+" ||
    t === "G+" ||
    t === "A+" ||
    t === "M+" ||
    t === "AVE+" ||
    t === "AVG+"
  ) {
    return "plus";
  }
  if (
    t === "-" ||
    t === "G-" ||
    t === "A-" ||
    t === "M-" ||
    t === "AVE-" ||
    t === "AVG-"
  ) {
    return "minus";
  }
  if (
    t === "G" ||
    t === "A" ||
    t === "M" ||
    t === "AVE" ||
    t === "AVG"
  ) {
    return "zero";
  }
  return undefined;
}

const AWARD_TOKEN =
  String.raw`(?:G\+|G-|A\+|A-|M\+|M-|AVE\+|AVE-|AVG\+|AVG-|AVE|AVG|G|A|M|\+|-)`;

/**
 * Parse NS/EW average awards from Remarks or Contract labels.
 * Supports Bridgemate `60%-40%` / `50%-50%` and locale labels `G+/G/G-`, `A+/A/A-`, `M+/M/M-`.
 */
export function parseAveragePmFromText(raw: string | null | undefined): {
  nsAward: AverageAward | null;
  ewAward: AverageAward | null;
} | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  const compact = s.toUpperCase().replace(/\s+/g, "").replace(/[−–]/g, "-");

  // Bridgemate percentage pair: 60%-40%, 50%/50%, en-dash, optional spaces
  const pct = s.match(/^(\d{2})\s*%\s*[-−–/]\s*(\d{2})\s*%$/i);
  if (pct) {
    const ns = mapPercentAward(Number(pct[1]));
    const ew = mapPercentAward(Number(pct[2]));
    if (ns === undefined || ew === undefined) return null;
    return { nsAward: ns, ewAward: ew };
  }

  // Label pair with explicit tokens so "A-" is not split on the minus
  const pairRe = new RegExp(
    `^(${AWARD_TOKEN})[/-](${AWARD_TOKEN})$`,
    "i",
  );
  const pair = compact.match(pairRe);
  if (pair) {
    const ns = parseAwardLabel(pair[1]!);
    const ew = parseAwardLabel(pair[2]!);
    if (ns !== undefined && ew !== undefined) {
      return { nsAward: ns, ewAward: ew };
    }
  }

  // Single-side label (typically Contract field): G+, G, A-
  const single = parseAwardLabel(compact);
  if (single !== undefined) {
    return { nsAward: single, ewAward: null };
  }

  return null;
}

function isNotPlayedText(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  const r = raw.trim().toLowerCase();
  if (/\bnot\s*played\b/.test(r)) return true;
  if (/\bniet\s*gespeeld\b/.test(r)) return true;
  // Exact NG / NP only — avoid matching substrings like "input"
  return /^(ng|np)$/i.test(raw.trim());
}

export type DetectedSpecial = {
  specialResultKind: SpecialResultKind;
  resolvedAdjustment: BuiltAdjustment | null;
};

/**
 * Detect Bridgemate special results from Contract + Remarks.
 * Auto-resolves NG → cancelled and unambiguous G± / G / 40%/60%/50% → average_pm.
 */
export function detectBridgemateSpecial(input: {
  remarks: string | null;
  erased: boolean;
  contract: string | null;
}): DetectedSpecial {
  const { remarks, erased, contract } = input;

  if (erased) {
    return { specialResultKind: "ERASED", resolvedAdjustment: null };
  }

  if (isNotPlayedText(remarks) || isNotPlayedText(contract)) {
    return {
      specialResultKind: "NOT_PLAYED",
      resolvedAdjustment: buildCancelledAdjustment({
        reason: remarks ?? contract,
      }),
    };
  }

  const fromRemarks = parseAveragePmFromText(remarks);
  const fromContract = parseAveragePmFromText(contract);
  const awards = fromRemarks ?? fromContract;
  if (awards && (awards.nsAward != null || awards.ewAward != null)) {
    return {
      specialResultKind: "ADJUSTED",
      resolvedAdjustment: buildAveragePmAdjustment({
        nsAward: awards.nsAward,
        ewAward: awards.ewAward,
        reason: remarks ?? contract,
      }),
    };
  }

  if (!remarks) {
    return { specialResultKind: "NONE", resolvedAdjustment: null };
  }

  const r = remarks.toLowerCase();
  if (
    /arbitral|arbitr|adjusted|aanpass|percentage|procent|%/.test(r)
  ) {
    return { specialResultKind: "ARBITRAL", resolvedAdjustment: null };
  }
  // Empty contract with remarks often means special
  if (!contract || !contract.trim()) {
    if (r.length > 0) {
      return { specialResultKind: "ARBITRAL", resolvedAdjustment: null };
    }
  }
  return { specialResultKind: "NONE", resolvedAdjustment: null };
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

  const detected = detectBridgemateSpecial({
    remarks,
    erased,
    contract: contractRaw,
  });
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

  // When special labels occupy Contract (or board was not played / average±),
  // do not treat residual contract fields as a real result.
  const clearContract =
    detected.resolvedAdjustment != null ||
    (detected.specialResultKind !== "NONE" &&
      parsed.contractDenomination == null &&
      parsed.contractLevel == null);

  return {
    contractLevel: clearContract ? null : parsed.contractLevel,
    contractDenomination: clearContract
      ? null
      : parsed.contractDenomination,
    doubling: clearContract ? "NONE" : parsed.doubling,
    declarer: clearContract ? null : declarer,
    tricksResult: clearContract ? null : tricksResult,
    tricksTaken: clearContract ? null : tricksTaken,
    bridgemateScore: scoreNs,
    specialResultKind: detected.specialResultKind,
    remarks,
    resolvedAdjustment: detected.resolvedAdjustment,
  };
}
