import { describe, expect, it } from "vitest";
import {
  NATIONAL_DEMO_DIVISIONS,
  nationalClubNameFromTeamName,
  normalizeNationalDemoTeamName,
  uniqueNationalClubNames,
} from "./demo-national-data";

describe("demo national data", () => {
  it("has 8 divisions with 8 teams each", () => {
    expect(NATIONAL_DEMO_DIVISIONS).toHaveLength(8);
    for (const division of NATIONAL_DEMO_DIVISIONS) {
      expect(division.teams).toHaveLength(8);
    }
  });

  it("lists 64 teams from last season", () => {
    const teamCount = NATIONAL_DEMO_DIVISIONS.reduce(
      (sum, d) => sum + d.teams.length,
      0,
    );
    expect(teamCount).toBe(64);
  });

  it("strips division round count from imported team labels", () => {
    expect(normalizeNationalDemoTeamName("BBC 121", 21)).toBe("BBC 1");
    expect(normalizeNationalDemoTeamName("Riviera 214", 14)).toBe("Riviera 2");
    expect(normalizeNationalDemoTeamName("Cercle-Perron 714", 14)).toBe(
      "Cercle-Perron 7",
    );
  });

  it("uses normalized team names in honor and 1st division", () => {
    const honor = NATIONAL_DEMO_DIVISIONS.find(
      (d) => d.divisionName === "Honor Division",
    );
    expect(honor?.teams).toContain("BBC 1");
    expect(honor?.teams).not.toContain("BBC 121");

    const first = NATIONAL_DEMO_DIVISIONS.find(
      (d) => d.divisionName === "1st Division",
    );
    expect(first?.teams).toContain("Sandeman 1");
    expect(first?.teams).not.toContain("Sandeman 114");
  });

  it("parses club names from team labels", () => {
    expect(nationalClubNameFromTeamName("Riviera 1")).toBe("Riviera");
    expect(nationalClubNameFromTeamName("Wilg & Donk 1")).toBe("Wilg & Donk");
    expect(nationalClubNameFromTeamName("B.C. Mons 1")).toBe("B.C. Mons");
  });

  it("derives unique clubs for player seeding", () => {
    const clubs = uniqueNationalClubNames();
    expect(clubs.length).toBe(30);
    expect(clubs).toContain("BBC");
    expect(clubs).toContain("Cercle-Perron");
  });
});
