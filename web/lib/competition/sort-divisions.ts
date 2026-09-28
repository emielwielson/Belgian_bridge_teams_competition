import { NATIONAL_DIVISIONS } from "./national-structure";
import { ZWEIFFEL_DIVISION_NAMES } from "./zweiffel-data";

const CANONICAL_DIVISION_ORDER = new Map<string, number>([
  ...NATIONAL_DIVISIONS.map((d, i) => [d.name, i] as const),
  ...ZWEIFFEL_DIVISION_NAMES.map((name, i) => [name, i] as const),
]);

/**
 * National: Honor → 1st → 2nd A/B → 3rd A–D.
 * Zweiffel: Honneur → 1 → 2A → 2B → APM 1 → APM 2.
 * Unknown names last, then alphabetical.
 */
export function sortDivisionsByCanonicalName<T extends { name: string }>(
  divisions: T[],
): T[] {
  return [...divisions].sort((a, b) => {
    const ai = CANONICAL_DIVISION_ORDER.get(a.name) ?? 99;
    const bi = CANONICAL_DIVISION_ORDER.get(b.name) ?? 99;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}
