export function formatImps(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const n = Math.round(value * 10) / 10;
  if (n > 0) return `+${n}`;
  return String(n);
}

export function formatContract(input: {
  contractLevel: number | null;
  contractDenomination: string | null;
  doubling: string;
  declarer: string | null;
  tricksResult: string | null;
}): string {
  if (input.contractDenomination === "PASS" || input.contractLevel == null) {
    return "PASS";
  }
  const den =
    input.contractDenomination === "NT"
      ? "NT"
      : input.contractDenomination === "SPADES"
        ? "♠"
        : input.contractDenomination === "HEARTS"
          ? "♥"
          : input.contractDenomination === "DIAMONDS"
            ? "♦"
            : input.contractDenomination === "CLUBS"
              ? "♣"
              : input.contractDenomination ?? "?";
  const x =
    input.doubling === "DOUBLED"
      ? "X"
      : input.doubling === "REDOUBLED"
        ? "XX"
        : "";
  return `${input.contractLevel}${den}${x} ${input.declarer ?? ""} ${input.tricksResult ?? ""}`.trim();
}
