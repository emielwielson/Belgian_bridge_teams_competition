import { describe, expect, it } from "vitest";
import {
  buildNationalReadiness,
  countSetMatchDays,
} from "./national-readiness";
import { NATIONAL_DIVISIONS } from "./national-structure";
import { NATIONAL_TEAMS_PER_GROUP } from "./national-teams";

describe("national-readiness", () => {
  it("counts match days from round rows", () => {
    expect(countSetMatchDays("honor", 21)).toEqual({
      required: 7,
      set: 7,
      complete: true,
    });
    expect(countSetMatchDays("honor", 6)).toEqual({
      required: 7,
      set: 2,
      complete: false,
    });
    expect(countSetMatchDays("default", 14)).toEqual({
      required: 14,
      set: 14,
      complete: true,
    });
  });

  it("canStartLeague when structure, calendars, and teams are complete", () => {
    const divisions = NATIONAL_DIVISIONS.map((spec) => ({
      name: spec.name,
      groupId: `g-${spec.name}`,
      teamCount: NATIONAL_TEAMS_PER_GROUP,
      required: NATIONAL_TEAMS_PER_GROUP,
      matchesCount: 0,
      complete: true,
    }));

    const result = buildNationalReadiness({
      seasonStatus: "setup",
      structureDivisionCount: 8,
      structureGroupCount: 8,
      calendarRoundCounts: { honor: 21, first: 14, default: 14 },
      divisions,
    });

    expect(result.canStartLeague).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("blocks when teams or calendars are incomplete", () => {
    const result = buildNationalReadiness({
      seasonStatus: "setup",
      structureDivisionCount: 8,
      structureGroupCount: 8,
      calendarRoundCounts: { honor: 0, first: 14, default: 14 },
      divisions: [
        {
          name: "Honor",
          groupId: "g1",
          teamCount: 4,
          required: 8,
          matchesCount: 0,
          complete: false,
        },
      ],
    });

    expect(result.canStartLeague).toBe(false);
    expect(result.blockers.some((b) => b.includes("Honor match days"))).toBe(
      true,
    );
    expect(result.blockers.some((b) => b.includes("Honor: 4/8"))).toBe(true);
  });
});
