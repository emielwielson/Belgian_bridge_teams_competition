/**
 * Standard WBF IMP conversion table (teams / Butler).
 * Point difference (absolute) → IMP magnitude 0–24.
 */

/** Inclusive upper bounds for each IMP value (IMP = index). */
const IMP_UPPER_BOUNDS: readonly number[] = [
  10, // 0
  40, // 1
  80, // 2
  120, // 3
  160, // 4
  210, // 5
  260, // 6
  310, // 7
  360, // 8
  420, // 9
  490, // 10
  590, // 11
  740, // 12
  890, // 13
  1090, // 14
  1290, // 15
  1490, // 16
  1740, // 17
  1990, // 18
  2240, // 19
  2490, // 20
  2990, // 21
  3490, // 22
  3990, // 23
  // 24: 4000+
];

/**
 * Convert a raw-score point difference to IMPs.
 * Sign of `diff` is preserved; `0 → 0`.
 */
export function pointsToImps(diff: number): number {
  if (diff === 0) return 0;
  const abs = Math.abs(diff);
  let imps = 24;
  for (let i = 0; i < IMP_UPPER_BOUNDS.length; i++) {
    if (abs <= IMP_UPPER_BOUNDS[i]!) {
      imps = i;
      break;
    }
  }
  return diff < 0 ? -imps : imps;
}
