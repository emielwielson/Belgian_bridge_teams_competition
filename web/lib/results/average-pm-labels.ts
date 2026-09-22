/**
 * Localized labels for assigned average awards (A+/A/A−, G+/G/G−, M+/M/M−).
 */

import type { AverageAward } from "@/lib/results/types";
import { parseAveragePmAwards } from "@/lib/results/adjustment-helpers";

export type AveragePmLabels = {
  plus: string;
  minus: string;
  zero: string;
};

/** en: A+/A/A−, nl: G+/G/G−, fr: M+/M/M− */
export function averageAwardLabel(
  award: AverageAward | null | undefined,
  labels: AveragePmLabels,
): string | null {
  if (award === "plus") return labels.plus;
  if (award === "minus") return labels.minus;
  if (award === "zero") return labels.zero;
  return null;
}

/** Compact score cell for a table with average_pm, e.g. "G / G−". */
export function formatAveragePmScoreCell(
  meta: Record<string, unknown> | null | undefined,
  labels: AveragePmLabels,
): string | null {
  const { nsAward, ewAward } = parseAveragePmAwards(meta);
  const ns = averageAwardLabel(nsAward, labels);
  const ew = averageAwardLabel(ewAward, labels);
  if (!ns && !ew) return null;
  return `${ns ?? "—"} / ${ew ?? "—"}`;
}
