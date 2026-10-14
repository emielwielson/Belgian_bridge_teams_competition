import { describe, expect, it } from "vitest";
import {
  allowsSecondaryMembers,
  eligibleMembershipTypes,
} from "./active-primary-membership";
import {
  isByeLabel,
  uniqueZweiffelClubNumbers,
  ZWEIFFEL_DIVISION_SPECS,
  ZWEIFFEL_PER_DIVISION_MATCH_DATE_NAMES,
  ZWEIFFEL_TEAM_CLUB_NUMBERS,
  zweiffelMatchDateCalendars,
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

  it("keeps Honneur on a 14-round evening calendar", () => {
    const honneur = ZWEIFFEL_DIVISION_SPECS.find((s) => s.name === "Honneur");
    expect(honneur?.roundCount).toBe(14);
    expect(honneur?.rounds).toHaveLength(14);
    expect(honneur?.rounds.every((r) => r.time === "20:00")).toBe(true);
    expect(honneur?.rounds.find((r) => r.round === 13)?.date).toBe(
      "2027-03-09",
    );
  });

  it("schedules APM divisions at 14:00 over 15 rounds including Feb 23", () => {
    for (const name of ["APM 1", "APM 2"] as const) {
      const apm = ZWEIFFEL_DIVISION_SPECS.find((s) => s.name === name);
      expect(apm?.roundCount).toBe(15);
      expect(apm?.rounds).toHaveLength(15);
      expect(apm?.rounds.every((r) => r.time === "14:00")).toBe(true);
      expect(apm?.rounds.find((r) => r.round === 13)?.date).toBe("2027-02-23");
    }
  });

  it("gives 2A a 15-round evening calendar with Feb 23", () => {
    const div2a = ZWEIFFEL_DIVISION_SPECS.find((s) => s.name === "2A");
    expect(div2a?.roundCount).toBe(15);
    expect(div2a?.rounds).toHaveLength(15);
    expect(div2a?.rounds.every((r) => r.time === "20:00")).toBe(true);
    expect(div2a?.rounds.find((r) => r.round === 13)?.date).toBe(
      "2027-02-23",
    );
  });

  it("plans region-wide Honneur plus per-division calendars for 2A/APM", () => {
    expect([...ZWEIFFEL_PER_DIVISION_MATCH_DATE_NAMES]).toEqual([
      "2A",
      "APM 1",
      "APM 2",
    ]);
    const plan = zweiffelMatchDateCalendars();
    expect(plan.regionWide).toHaveLength(14);
    expect(plan.regionWide.every((r) => r.time === "20:00")).toBe(true);
    expect(plan.perDivision.map((d) => d.name)).toEqual([
      "2A",
      "APM 1",
      "APM 2",
    ]);
    expect(plan.perDivision.find((d) => d.name === "2A")?.rounds).toHaveLength(
      15,
    );
    expect(
      plan.perDivision
        .find((d) => d.name === "APM 2")
        ?.rounds.every((r) => r.time === "14:00"),
    ).toBe(true);
  });
});
