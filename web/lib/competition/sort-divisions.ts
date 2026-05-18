import { NATIONAL_DIVISIONS } from "./national-structure";

const CANONICAL_DIVISION_ORDER = new Map(
  NATIONAL_DIVISIONS.map((d, i) => [d.name, i]),
);

/** Honor → 1st → 2nd A/B → 3rd A–D; unknown names last, then alphabetical. */
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
