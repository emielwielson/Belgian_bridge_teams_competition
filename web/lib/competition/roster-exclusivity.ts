/** Exclusivity pools for team roster membership within a season. */
export type RosterExclusivityPool = "linked" | "zweiffel";

/**
 * National / Flanders / Wallonia share one roster slot per player per season.
 * Zweiffel is a separate pool (same player may also be on one Zweiffel team).
 */
export function rosterExclusivityPool(
  kindCode: string | null | undefined,
): RosterExclusivityPool | null {
  if (kindCode == null || kindCode === "") return null;
  if (kindCode === "zweiffel") return "zweiffel";
  if (
    kindCode === "national" ||
    kindCode === "flanders" ||
    kindCode === "wallonia"
  ) {
    return "linked";
  }
  return null;
}

export function sameRosterExclusivityPool(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const poolA = rosterExclusivityPool(a);
  const poolB = rosterExclusivityPool(b);
  return poolA != null && poolB != null && poolA === poolB;
}
