/**
 * Parse Bridgemate LeadCard strings (e.g. SA, HK, DQ, CJ, S10, ST).
 */

export type ParsedLeadCard = {
  suit: "S" | "H" | "D" | "C";
  rank: string;
};

const SUIT_SYMBOL: Record<ParsedLeadCard["suit"], string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

const RANK_ALIASES: Record<string, string> = {
  T: "10",
  "10": "10",
  A: "A",
  K: "K",
  Q: "Q",
  J: "J",
};

/**
 * Parse a Bridgemate lead card into suit + display rank.
 * Accepts suit-first forms: SA, HK, S10, ST, C2.
 */
export function parseLeadCard(
  raw: string | null | undefined,
): ParsedLeadCard | null {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === "") return null;

  const m = s.match(/^([SHDC])(10|[2-9TJQKA])$/);
  if (!m) return null;

  const suit = m[1] as ParsedLeadCard["suit"];
  const rankToken = m[2]!;
  const rank = RANK_ALIASES[rankToken] ?? rankToken;
  return { suit, rank };
}

/** Display form with Unicode suit, e.g. ♠A. Null if unparseable. */
export function formatLeadCard(
  raw: string | null | undefined,
): string | null {
  const parsed = parseLeadCard(raw);
  if (!parsed) return null;
  return `${SUIT_SYMBOL[parsed.suit]}${parsed.rank}`;
}

export function leadSuitSymbol(suit: ParsedLeadCard["suit"]): string {
  return SUIT_SYMBOL[suit];
}

export function isRedLeadSuit(suit: ParsedLeadCard["suit"]): boolean {
  return suit === "H" || suit === "D";
}
