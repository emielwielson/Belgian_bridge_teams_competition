import type { BoardHands, Dealer, Hand, Vulnerability } from "@/lib/boards/types";

const SUIT_META = [
  { key: "S" as const, symbol: "♠", className: "text-zinc-900" },
  { key: "H" as const, symbol: "♥", className: "text-red-600" },
  { key: "D" as const, symbol: "♦", className: "text-red-600" },
  { key: "C" as const, symbol: "♣", className: "text-zinc-900" },
];

const DEFAULT_SEAT_LETTERS: Record<Dealer, string> = {
  N: "N",
  E: "E",
  S: "S",
  W: "W",
};

/** Classic deal-plate colours — inline so they always paint. */
const VUL_BG = "#dc2626";
const NON_VUL_BG = "#16a34a";

export type HandDiagramLabels = {
  /** Accessible summary, e.g. "Dealer North, nobody vulnerable" */
  dealPlateAria: string;
  seatLetters?: Partial<Record<Dealer, string>>;
  boardLabel?: string;
};

/** Tokenize PBN-style holdings so T/10 stay one unit. */
export function formatRanks(holding: string): string {
  if (!holding) return "—";
  const tokens: string[] = [];
  for (const ch of holding) {
    tokens.push(ch === "T" ? "10" : ch);
  }
  return tokens.join("\u2009");
}

function isNsVulnerable(vulnerability: Vulnerability | null | undefined): boolean {
  return vulnerability === "NS" || vulnerability === "BOTH";
}

function isEwVulnerable(vulnerability: Vulnerability | null | undefined): boolean {
  return vulnerability === "EW" || vulnerability === "BOTH";
}

function HandBlock({ hand }: { hand: Hand }) {
  return (
    <ul className="flex w-max max-w-full flex-col gap-0.5 font-mono text-[0.8125rem] leading-tight tracking-tight sm:text-sm">
      {SUIT_META.map((suit) => (
        <li key={suit.key} className="flex gap-1">
          <span
            className={`w-3.5 shrink-0 text-left font-sans text-sm ${suit.className}`}
            aria-hidden
          >
            {suit.symbol}
          </span>
          <span className="whitespace-nowrap text-left text-zinc-900">
            {formatRanks(hand[suit.key])}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DealPlate({
  dealer,
  vulnerability,
  seatLetters,
  ariaLabel,
}: {
  dealer: Dealer | null;
  vulnerability: Vulnerability | null;
  seatLetters: Record<Dealer, string>;
  ariaLabel: string;
}) {
  const nsColor = isNsVulnerable(vulnerability) ? VUL_BG : NON_VUL_BG;
  const ewColor = isEwVulnerable(vulnerability) ? VUL_BG : NON_VUL_BG;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="flex shrink-0 items-center justify-center bg-white"
      style={{
        width: 40,
        height: 40,
        minWidth: 40,
        minHeight: 40,
        boxSizing: "border-box",
        borderRadius: 6,
        // Sides: top/bottom = NS, left/right = EW; red = vul, green = not.
        borderTop: `5px solid ${nsColor}`,
        borderBottom: `5px solid ${nsColor}`,
        borderLeft: `5px solid ${ewColor}`,
        borderRight: `5px solid ${ewColor}`,
      }}
    >
      <span className="text-sm font-bold leading-none text-zinc-900">
        {dealer ? seatLetters[dealer] : "—"}
      </span>
    </div>
  );
}

export function HandDiagram({
  boardNumber,
  dealer,
  vulnerability,
  hands,
  labels,
  showBoardNumber = true,
}: {
  boardNumber?: number;
  dealer?: Dealer | string | null;
  vulnerability?: Vulnerability | string | null;
  hands: BoardHands;
  labels?: HandDiagramLabels;
  /** When false, omit the “Bord n” line (e.g. page already has an h1). */
  showBoardNumber?: boolean;
}) {
  const seatLetters: Record<Dealer, string> = {
    ...DEFAULT_SEAT_LETTERS,
    ...labels?.seatLetters,
  };
  const dealerSeat = (dealer as Dealer | null | undefined) ?? null;
  const vuln = (vulnerability as Vulnerability | null | undefined) ?? null;
  const ariaLabel =
    labels?.dealPlateAria ??
    `Dealer ${dealerSeat ?? "—"}, vulnerability ${vuln ?? "—"}`;

  return (
    <div className="w-full" role="group" aria-label={ariaLabel}>
      {showBoardNumber && boardNumber != null ? (
        <div className="mb-2 text-sm font-semibold text-zinc-900">
          {labels?.boardLabel ?? `Board ${boardNumber}`}
        </div>
      ) : null}

      <div
        className="grid items-center justify-items-center gap-x-3 gap-y-3"
        style={{
          gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
          gridTemplateRows: "auto auto auto",
        }}
      >
        <div className="col-start-2 row-start-1 justify-self-center">
          <HandBlock hand={hands.N} />
        </div>

        <div className="col-start-1 row-start-2 justify-self-end">
          <HandBlock hand={hands.W} />
        </div>

        <div className="col-start-2 row-start-2 self-center justify-self-center">
          <DealPlate
            dealer={dealerSeat}
            vulnerability={vuln}
            seatLetters={seatLetters}
            ariaLabel={ariaLabel}
          />
        </div>

        <div className="col-start-3 row-start-2 justify-self-start">
          <HandBlock hand={hands.E} />
        </div>

        <div className="col-start-2 row-start-3 justify-self-center">
          <HandBlock hand={hands.S} />
        </div>
      </div>
    </div>
  );
}
