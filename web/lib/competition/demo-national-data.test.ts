import { describe, expect, it } from "vitest";
import {
  NATIONAL_DEMO_DIVISIONS,
  nationalClubNameFromTeamName,
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

  it("parses club names from team labels", () => {
    expect(nationalClubNameFromTeamName("Riviera 121")).toBe("Riviera");
    expect(nationalClubNameFromTeamName("Wilg & Donk 114")).toBe("Wilg & Donk");
    expect(nationalClubNameFromTeamName("B.C. Mons 114")).toBe("B.C. Mons");
  });

  it("derives unique clubs for player seeding", () => {
    const clubs = uniqueNationalClubNames();
    expect(clubs.length).toBe(30);
    expect(clubs).toContain("BBC");
    expect(clubs).toContain("Cercle-Perron");
  });
});
