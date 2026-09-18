import {
  isRedLeadSuit,
  leadSuitSymbol,
  parseLeadCard,
} from "@/lib/bridgemate/lead-card";

/** Coloured opening-lead display (e.g. ♠A, ♥K). Missing/invalid → —. */
export function LeadLabel({
  leadCard,
}: {
  leadCard: string | null | undefined;
}) {
  const parsed = parseLeadCard(leadCard);
  if (!parsed) {
    return (
      <span className="whitespace-nowrap font-mono text-sm text-zinc-400">
        —
      </span>
    );
  }

  const symbol = leadSuitSymbol(parsed.suit);
  const className = isRedLeadSuit(parsed.suit)
    ? "text-red-600"
    : "text-zinc-900";

  return (
    <span className="whitespace-nowrap font-mono text-sm">
      <span className={className} aria-hidden>
        {symbol}
      </span>
      {parsed.rank}
    </span>
  );
}
