import { describe, expect, it } from "vitest";
import {
  allowsSecondaryMembers,
  eligibleMembershipTypes,
} from "./active-primary-membership";
import {
  isByeLabel,
  uniqueZweiffelClubNumbers,
  ZWEIFFEL_DIVISION_SPECS,
  ZWEIFFEL_TEAM_CLUB_NUMBERS,
} from "./zweiffel-data";

describe("allowsSecondaryMembers", () => {
  it("is true only for zweiffel", () => {
    expect(allowsSecondaryMembers("zweiffel")).toBe(true);
    expect(allowsSecondaryMembers("flanders")).toBe(false);
    expect(allowsSecondaryMembers(null)).toBe(false);
  });
});

describe("eligibleMembershipTypes", () => {
  it("includes second and federation for zweiffel", () => {
    expect(eligibleMembershipTypes("zweiffel")).toEqual([
      "primary",
      "second",
      "federation",
    ]);
    expect(eligibleMembershipTypes("national")).toEqual(["primary"]);
  });
});

describe("zweiffel-data", () => {
  it("has six divisions with club mappings for every team", () => {
    expect(ZWEIFFEL_DIVISION_SPECS).toHaveLength(6);
    for (const spec of ZWEIFFEL_DIVISION_SPECS) {
      for (const team of spec.teams) {
        expect(ZWEIFFEL_TEAM_CLUB_NUMBERS[team]).toBeTruthy();
      }
    }
  });

  it("applies renames (Dekandelaer in 1, Gilles in 2A)", () => {
    const div1 = ZWEIFFEL_DIVISION_SPECS.find((s) => s.name === "1");
    const div2a = ZWEIFFEL_DIVISION_SPECS.find((s) => s.name === "2A");
    expect(div1?.teams).toContain("7F Dekandelaer");
    expect(div1?.teams).not.toContain("7F Gilles");
    expect(div2a?.teams).toContain("7F Gilles");
    expect(div2a?.teams).not.toContain("7F Debaeke");
  });

  it("treats Bye labels", () => {
    expect(isByeLabel("Bye")).toBe(true);
    expect(isByeLabel("BBC Dehaye")).toBe(false);
  });

  it("lists unique club numbers", () => {
    expect(uniqueZweiffelClubNumbers().length).toBeGreaterThanOrEqual(12);
  });
});
