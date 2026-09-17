import type { Dealer, Vulnerability } from "@/lib/boards/types";
import type { BoardHands, Hand, ParsedBoard } from "@/lib/boards/types";

const DEALERS: Dealer[] = ["N", "E", "S", "W"];
const HAND_ORDER: Dealer[] = ["N", "E", "S", "W"];

function parseTagValue(block: string, tag: string): string | null {
  const re = new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`, "i");
  const m = block.match(re);
  return m ? m[1] : null;
}

function splitDeals(pbn: string): string[] {
  const normalized = pbn.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const parts: string[] = [];
  const boardStarts = [...normalized.matchAll(/\[Board\s+"/gi)];
  if (boardStarts.length === 0) {
    return [normalized];
  }
  for (let i = 0; i < boardStarts.length; i++) {
    const start = boardStarts[i].index ?? 0;
    const end =
      i + 1 < boardStarts.length
        ? (boardStarts[i + 1].index ?? normalized.length)
        : normalized.length;
    parts.push(normalized.slice(start, end).trim());
  }
  return parts.filter(Boolean);
}

function parseDealer(raw: string | null): Dealer | null {
  if (!raw) return null;
  const d = raw.trim().toUpperCase();
  if (d === "N" || d === "E" || d === "S" || d === "W") return d;
  if (d === "NORTH") return "N";
  if (d === "EAST") return "E";
  if (d === "SOUTH") return "S";
  if (d === "WEST") return "W";
  return null;
}

function parseVulnerability(raw: string | null): Vulnerability | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "none" || v === "-" || v === "love" || v === "0") return "NONE";
  if (v === "ns" || v === "n-s" || v === "n/s") return "NS";
  if (v === "ew" || v === "e-w" || v === "e/w") return "EW";
  if (v === "all" || v === "both" || v === "b") return "BOTH";
  return null;
}

function parseBoardNumber(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

/** Parse one hand string "AKQ.JT9.xxx.xx" into suits. */
export function parseHandString(hand: string): Hand | null {
  const parts = hand.trim().split(".");
  if (parts.length !== 4) return null;
  return {
    S: parts[0].toUpperCase().replace(/10/g, "T"),
    H: parts[1].toUpperCase().replace(/10/g, "T"),
    D: parts[2].toUpperCase().replace(/10/g, "T"),
    C: parts[3].toUpperCase().replace(/10/g, "T"),
  };
}

/**
 * Parse PBN Deal tag value, e.g. `N:AKQ.xxx.... E:... S:... W:...`
 * First character before `:` is the starting seat; hands follow clockwise.
 */
export function parseDealTag(deal: string): BoardHands | null {
  const trimmed = deal.trim();
  const colon = trimmed.indexOf(":");
  if (colon < 1) return null;
  const startSeat = trimmed.slice(0, colon).trim().toUpperCase();
  if (!DEALERS.includes(startSeat as Dealer)) return null;

  const rest = trimmed.slice(colon + 1).trim();
  const handStrings = rest.split(/\s+/).filter(Boolean);
  if (handStrings.length !== 4) return null;

  const startIdx = HAND_ORDER.indexOf(startSeat as Dealer);
  const hands: Partial<BoardHands> = {};
  for (let i = 0; i < 4; i++) {
    const seat = HAND_ORDER[(startIdx + i) % 4];
    const parsed = parseHandString(handStrings[i]);
    if (!parsed) return null;
    hands[seat] = parsed;
  }
  return hands as BoardHands;
}

export type ParsePbnResult =
  | { ok: true; boards: ParsedBoard[] }
  | { ok: false; errors: string[] };

/**
 * Parse MVP PBN into boards. Structural parse errors are returned in Dutch;
 * card-completeness validation is separate (board-validator).
 */
export function parsePbn(pbnText: string): ParsePbnResult {
  const blocks = splitDeals(pbnText);
  if (blocks.length === 0) {
    return { ok: false, errors: ["PBN-bestand is leeg."] };
  }

  const boards: ParsedBoard[] = [];
  const errors: string[] = [];

  for (const block of blocks) {
    const boardRaw = parseTagValue(block, "Board");
    const dealerRaw = parseTagValue(block, "Dealer");
    const vulnRaw = parseTagValue(block, "Vulnerable");
    const dealRaw = parseTagValue(block, "Deal");

    const boardNumber = parseBoardNumber(boardRaw);
    const dealer = parseDealer(dealerRaw);
    const vulnerability = parseVulnerability(vulnRaw);

    const label = boardNumber != null ? `Bord ${boardNumber}` : "Bord ?";

    if (boardNumber == null) {
      errors.push(`${label}: Ongeldig of ontbrekend bordnummer.`);
      continue;
    }
    if (dealer == null) {
      errors.push(`${label}: Ongeldige of ontbrekende dealer.`);
      continue;
    }
    if (vulnerability == null) {
      errors.push(`${label}: Ongeldige of ontbrekende kwetsbaarheid.`);
      continue;
    }
    if (!dealRaw) {
      errors.push(`${label}: Ontbrekende Deal-tag.`);
      continue;
    }
    const hands = parseDealTag(dealRaw);
    if (!hands) {
      errors.push(
        `${label}: Deal-tag kon niet worden gelezen (verwacht 4 handen).`,
      );
      continue;
    }

    boards.push({ boardNumber, dealer, vulnerability, hands });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  if (boards.length === 0) {
    return { ok: false, errors: ["Geen borden gevonden in PBN."] };
  }
  return { ok: true, boards };
}
