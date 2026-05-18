import { describe, expect, it } from "vitest";
import { sortDivisionsByCanonicalName } from "./sort-divisions";

describe("sortDivisionsByCanonicalName", () => {
  it("orders national divisions from Honor through 3rd D", () => {
    const input = [
      { name: "3rd Division D", id: "d" },
      { name: "2nd Division B", id: "b" },
      { name: "Honor Division", id: "h" },
      { name: "1st Division", id: "1" },
      { name: "3rd Division A", id: "a" },
      { name: "2nd Division A", id: "2a" },
    ];

    const sorted = sortDivisionsByCanonicalName(input);
    expect(sorted.map((d) => d.name)).toEqual([
      "Honor Division",
      "1st Division",
      "2nd Division A",
      "2nd Division B",
      "3rd Division A",
      "3rd Division D",
    ]);
  });

  it("places unknown division names after canonical ones, alphabetically", () => {
    const input = [
      { name: "Zebra", id: "z" },
      { name: "Honor Division", id: "h" },
      { name: "Alpha", id: "a" },
    ];

    const sorted = sortDivisionsByCanonicalName(input);
    expect(sorted.map((d) => d.name)).toEqual(["Honor Division", "Alpha", "Zebra"]);
  });
});
