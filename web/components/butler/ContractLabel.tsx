import type { ReactNode } from "react";

const SUIT_CLASS: Record<string, string> = {
  "♠": "text-zinc-900",
  "♥": "text-red-600",
  "♦": "text-red-600",
  "♣": "text-zinc-900",
};

export type ContractLabelInput = {
  contractLevel: number | null;
  contractDenomination: string | null;
  doubling: string;
  declarer: string | null;
  tricksResult: string | null;
};

function suitSymbol(denomination: string | null): {
  symbol: string;
  className?: string;
} | null {
  if (denomination === "NT") return { symbol: "NT" };
  if (denomination === "SPADES")
    return { symbol: "♠", className: SUIT_CLASS["♠"] };
  if (denomination === "HEARTS")
    return { symbol: "♥", className: SUIT_CLASS["♥"] };
  if (denomination === "DIAMONDS")
    return { symbol: "♦", className: SUIT_CLASS["♦"] };
  if (denomination === "CLUBS")
    return { symbol: "♣", className: SUIT_CLASS["♣"] };
  if (denomination) return { symbol: denomination };
  return null;
}

/** Coloured, single-line contract display (e.g. 4♠X N =). */
export function ContractLabel({
  contractLevel,
  contractDenomination,
  doubling,
  declarer,
  tricksResult,
}: ContractLabelInput) {
  if (contractDenomination === "PASS" || contractLevel == null) {
    return (
      <span className="whitespace-nowrap font-mono text-sm">PASS</span>
    );
  }

  const suit = suitSymbol(contractDenomination);
  const x =
    doubling === "DOUBLED" ? "X" : doubling === "REDOUBLED" ? "XX" : "";

  const parts: ReactNode[] = [
    <span key="level">{contractLevel}</span>,
  ];
  if (suit) {
    parts.push(
      <span key="suit" className={suit.className} aria-hidden={!!suit.className}>
        {suit.symbol}
      </span>,
    );
  }
  if (x) parts.push(<span key="x">{x}</span>);

  const tail = [declarer, tricksResult].filter(Boolean).join(" ");
  if (tail) {
    parts.push(
      <span key="tail">
        {" "}
        {tail}
      </span>,
    );
  }

  return (
    <span className="whitespace-nowrap font-mono text-sm">{parts}</span>
  );
}
