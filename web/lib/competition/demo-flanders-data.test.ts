import { describe, expect, it } from "vitest";
import {
  FLANDERS_DEMO_GROUPS,
  clubNameFromTeamName,
  uniqueFlandersClubNames,
} from "./demo-flanders-data";

describe("demo flanders data", () => {
  it("has 13 groups across Liga 1–3", () => {
    expect(FLANDERS_DEMO_GROUPS).toHaveLength(13);
    expect(FLANDERS_DEMO_GROUPS.filter((g) => g.liga === 1)).toHaveLength(4);
    expect(FLANDERS_DEMO_GROUPS.filter((g) => g.liga === 2)).toHaveLength(7);
    expect(FLANDERS_DEMO_GROUPS.filter((g) => g.liga === 3)).toHaveLength(2);
  });

  it("lists 97 teams from last season", () => {
    const teamCount = FLANDERS_DEMO_GROUPS.reduce(
      (sum, g) => sum + g.teams.length,
      0,
    );
    expect(teamCount).toBe(97);
  });

  it("has nine 8-team groups for scheduling", () => {
    const eightTeam = FLANDERS_DEMO_GROUPS.filter((g) => g.teams.length === 8);
    expect(eightTeam).toHaveLength(9);
  });

  it("parses club names from team labels", () => {
    expect(clubNameFromTeamName("Waregem 4")).toBe("Waregem");
    expect(clubNameFromTeamName("Veurne C1")).toBe("Veurne");
    expect(clubNameFromTeamName("Leopoldsburg 1C")).toBe("Leopoldsburg");
    expect(clubNameFromTeamName("Wilg&Donk 2")).toBe("Wilg&Donk");
  });

  it("derives unique clubs for player seeding", () => {
    const clubs = uniqueFlandersClubNames();
    expect(clubs.length).toBeGreaterThan(40);
    expect(clubs).toContain("Sandeman");
    expect(clubs).toContain("Kwadraat");
    expect(clubs).toContain("Kwatdraat");
  });
});
