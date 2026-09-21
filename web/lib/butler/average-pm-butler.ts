/**
 * Butler IMP awards for average +/− (A+/A−, G+/G−).
 */

import type { AverageAward } from "@/lib/results/types";

export const AVERAGE_PM_BUTLER_FLOOR = 2;

/** G+: max(2, avg); G−: min(−2, avg); missing avg → ±2. */
export function butlerImpsForAverageAward(
  award: AverageAward,
  averageImps: number | null,
): number {
  if (award === "plus") {
    if (averageImps == null) return AVERAGE_PM_BUTLER_FLOOR;
    return Math.max(AVERAGE_PM_BUTLER_FLOOR, averageImps);
  }
  if (averageImps == null) return -AVERAGE_PM_BUTLER_FLOOR;
  return Math.min(-AVERAGE_PM_BUTLER_FLOOR, averageImps);
}

export type CombinationImpCredit = {
  combinationId: string;
  imps: number;
};

/** Average IMP per combination from pass-1 credits (excludes null/average_pm boards). */
export function combinationRoundAverages(
  credits: readonly CombinationImpCredit[],
): Map<string, number> {
  const totals = new Map<string, { sum: number; n: number }>();
  for (const c of credits) {
    const cur = totals.get(c.combinationId) ?? { sum: 0, n: 0 };
    cur.sum += c.imps;
    cur.n += 1;
    totals.set(c.combinationId, cur);
  }
  const avgs = new Map<string, number>();
  for (const [id, v] of totals) {
    if (v.n > 0) avgs.set(id, v.sum / v.n);
  }
  return avgs;
}
