import type { BoardHands, Hand } from "@/lib/boards/types";

const SUIT_META = [
  { key: "S" as const, symbol: "♠", className: "text-zinc-900" },
  { key: "H" as const, symbol: "♥", className: "text-red-600" },
  { key: "D" as const, symbol: "♦", className: "text-red-600" },
  { key: "C" as const, symbol: "♣", className: "text-zinc-900" },
];

function formatRanks(holding: string): string {
  if (!holding) return "—";
  return holding.replace(/T/g, "10").split("").join("\u2009");
}

function HandBlock({
  label,
  hand,
  className = "",
}: {
  label: string;
  hand: Hand;
  className?: string;
}) {
  return (
    <div
      className={`rounded border border-zinc-200 bg-white px-3 py-2 ${className}`}
    >
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <ul className="space-y-0.5 font-mono text-base leading-snug sm:text-lg">
        {SUIT_META.map((suit) => (
          <li key={suit.key} className="flex gap-2">
            <span className={`w-4 shrink-0 font-sans ${suit.className}`} aria-hidden>
              {suit.symbol}
            </span>
            <span className="text-zinc-900">{formatRanks(hand[suit.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const VULN_NL: Record<string, string> = {
  NONE: "Niemand kwetsbaar",
  NS: "NZ kwetsbaar",
  EW: "OW kwetsbaar",
  BOTH: "Allen kwetsbaar",
};

const DEALER_NL: Record<string, string> = {
  N: "Noord",
  E: "Oost",
  S: "Zuid",
  W: "West",
};

export function HandDiagram({
  boardNumber,
  dealer,
  vulnerability,
  hands,
}: {
  boardNumber?: number;
  dealer?: string | null;
  vulnerability?: string | null;
  hands: BoardHands;
}) {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm text-zinc-700">
        <span className="font-semibold text-zinc-900">
          {boardNumber != null ? `Bord ${boardNumber}` : "Bord"}
        </span>
        <span>
          Dealer {dealer ? DEALER_NL[dealer] ?? dealer : "—"}
          {" · "}
          {vulnerability ? VULN_NL[vulnerability] ?? vulnerability : "—"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-start-2">
          <HandBlock label="Noord" hand={hands.N} />
        </div>
        <div className="col-start-1 row-start-2">
          <HandBlock label="West" hand={hands.W} />
        </div>
        <div className="col-start-3 row-start-2">
          <HandBlock label="Oost" hand={hands.E} />
        </div>
        <div className="col-start-2 row-start-3">
          <HandBlock label="Zuid" hand={hands.S} />
        </div>
      </div>
    </div>
  );
}
