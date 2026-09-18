import { describe, expect, it } from "vitest";
import { filterStandingsByMinRounds } from "@/lib/butler/filter-standings";

function row(
  id: string,
  averageImps: number,
  roundsPlayed: number,
  rank: number,
) {
  return { id, averageImps, roundsPlayed, rank };
}

describe("filterStandingsByMinRounds", () => {
  const rows = [
    row("a", 12, 5, 1),
    row("b", 10, 2, 2),
    row("c", 10, 4, 2),
    row("d", 8, 1, 4),
  ];

  it("is identity when minRounds is 0", () => {
    const filtered = filterStandingsByMinRounds(rows, 0);
    expect(filtered.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    expect(filtered.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("drops pairs below the threshold and re-ranks", () => {
    const filtered = filterStandingsByMinRounds(rows, 3);
    expect(filtered.map((r) => r.id)).toEqual(["a", "c"]);
    expect(filtered.map((r) => r.rank)).toEqual([1, 2]);
    expect(filtered.map((r) => r.averageImps)).toEqual([12, 10]);
  });

  it("preserves shared ranks after filtering", () => {
    const filtered = filterStandingsByMinRounds(rows, 2);
    expect(filtered.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(filtered.map((r) => r.rank)).toEqual([1, 2, 2]);
  });

  it("floors minRounds and treats negatives as 0", () => {
    expect(filterStandingsByMinRounds(rows, -2)).toHaveLength(4);
    expect(filterStandingsByMinRounds(rows, 2.9).map((r) => r.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
