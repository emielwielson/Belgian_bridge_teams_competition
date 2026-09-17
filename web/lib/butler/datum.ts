/**
 * Per-board NS datum: trimmed mean, round upward to nearest 10 (PRD §4.8.1).
 */

export type DatumConfig = {
  /** Round mean to nearest N (default 10). */
  roundDatumToNearest?: number;
};

export type DatumResult =
  | { ok: true; nsDatum: number; ewDatum: number; mean: number; n: number; k: number }
  | { ok: false; reason: "too_few" | "trim_too_aggressive"; n: number; k: number };

/**
 * How many scores to discard from each end for N included results.
 * Returns null when datum cannot be computed (N < 3).
 */
export function trimCount(n: number): number | null {
  if (n < 3) return null;
  if (n <= 10) return 1;
  if (n <= 15) return 2;
  if (n <= 20) return 3;
  // 21+: k = floor((N-1)/5) but at least 3, and leave at least 2 after trim
  let k = Math.floor((n - 1) / 5);
  if (k < 3) k = 3;
  // Ensure at least 2 remain: n - 2k >= 2 ⇒ k <= (n-2)/2
  const maxK = Math.floor((n - 2) / 2);
  if (k > maxK) k = maxK;
  if (n - 2 * k < 2) return null;
  return k;
}

/** Round upward toward +∞ to nearest `nearest` (45→50, −45→−40). */
export function roundUpToNearest(value: number, nearest: number): number {
  return Math.ceil(value / nearest) * nearest;
}

/**
 * Compute NS (and EW) datum from included NS raw scores.
 */
export function computeNsDatum(
  scores: readonly number[],
  config: DatumConfig = {},
): DatumResult {
  const n = scores.length;
  const kOrNull = trimCount(n);
  if (kOrNull == null) {
    return { ok: false, reason: "too_few", n, k: 0 };
  }
  const k = kOrNull;
  if (n - 2 * k < 2) {
    return { ok: false, reason: "trim_too_aggressive", n, k };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const trimmed = sorted.slice(k, n - k);
  const mean = trimmed.reduce((sum, s) => sum + s, 0) / trimmed.length;
  const nearest = config.roundDatumToNearest ?? 10;
  const nsDatum = roundUpToNearest(mean, nearest);
  return {
    ok: true,
    nsDatum,
    ewDatum: -nsDatum,
    mean,
    n,
    k,
  };
}
