import { assignSharedRanks } from "@/lib/butler/engine";

export type MinRoundsStandingRow = {
  roundsPlayed: number;
  averageImps: number | null;
  rank: number;
};

/**
 * Display filter: keep pairs with at least `minRounds` matches (distinct rounds),
 * then reassign ranks by average IMP (same shared-rank rules as aggregation).
 * Input rows must already be sorted by average IMP descending.
 */
export function filterStandingsByMinRounds<T extends MinRoundsStandingRow>(
  rows: readonly T[],
  minRounds: number,
): T[] {
  const threshold = Math.max(0, Math.floor(minRounds));
  const filtered =
    threshold <= 0
      ? [...rows]
      : rows.filter((row) => row.roundsPlayed >= threshold);

  const ranks = assignSharedRanks(
    filtered.map((r) => r.averageImps ?? Number.NEGATIVE_INFINITY),
  );
  return filtered.map((row, i) => ({ ...row, rank: ranks[i]! }));
}
