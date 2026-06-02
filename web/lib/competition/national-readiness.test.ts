import { describe, expect, it } from "vitest";
import {
  buildNationalReadiness,
  countSetMatchDays,
  divisionTeamsComplete,
} from "./national-readiness";
import { NATIONAL_DIVISIONS } from "./national-structure";
import { NATIONAL_TEAMS_PER_GROUP } from "./national-teams";

function divisionRow(
  name: string,
  teamCount: number,
  matchesCount: number,
  slotsComplete = teamCount === NATIONAL_TEAMS_PER_GROUP,
): {
  name: string;
  groupId: string;
  teamCount: number;
  required: number;
  minTeams: number;
  matchesCount: number;
  teamsComplete: boolean;
  slotsComplete: boolean;
  scheduleComplete: boolean;
} {
  return {
    name,
    groupId: `g-${name}`,
    teamCount,
    required: NATIONAL_TEAMS_PER_GROUP,
    minTeams: 7,
    matchesCount,
    teamsComplete: slotsComplete && teamCount >= 7 && teamCount <= 8,
    slotsComplete,
    scheduleComplete: matchesCount > 0,
  };
}

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
  });

  it("divisionTeamsComplete ignores existing fixtures", () => {
    const div = divisionRow("Honor Division", 8, 84);
    expect(divisionTeamsComplete(div)).toBe(true);
  });

  it("canStartLeague when teams and calendars ready and no fixtures yet", () => {
    const divisions = NATIONAL_DIVISIONS.map((spec) =>
      divisionRow(spec.name, NATIONAL_TEAMS_PER_GROUP, 0),
    );

    const result = buildNationalReadiness({
      seasonStatus: "setup",
      structureDivisionCount: 8,
      structureGroupCount: 8,
      calendarRoundCounts: { honor: 21, first: 14, default: 14 },
      divisions,
    });

    expect(result.allTeamsReady).toBe(true);
    expect(result.allSchedulesReady).toBe(false);
    expect(result.canStartLeague).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("canStartLeague when fixtures already generated (activate only)", () => {
    const divisions = NATIONAL_DIVISIONS.map((spec) =>
      divisionRow(spec.name, NATIONAL_TEAMS_PER_GROUP, 84),
    );

    const result = buildNationalReadiness({
      seasonStatus: "setup",
      structureDivisionCount: 8,
      structureGroupCount: 8,
      calendarRoundCounts: { honor: 21, first: 14, default: 14 },
      divisions,
    });

    expect(result.allTeamsReady).toBe(true);
    expect(result.allSchedulesReady).toBe(true);
    expect(result.canStartLeague).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("blocks when teams or calendars are incomplete", () => {
    const result = buildNationalReadiness({
      seasonStatus: "setup",
      structureDivisionCount: 8,
      structureGroupCount: 8,
      calendarRoundCounts: { honor: 0, first: 14, default: 14 },
      divisions: [divisionRow("Honor Division", 4, 0)],
    });

    expect(result.allTeamsReady).toBe(false);
    expect(result.canStartLeague).toBe(false);
    expect(result.blockers.some((b) => b.includes("Honor Division match days"))).toBe(
      true,
    );
    expect(result.blockers.some((b) => b.includes("Honor Division: 4/8"))).toBe(
      true,
    );
  });

  it("divisionTeamsComplete accepts 7 teams with complete slots and bye", () => {
    const div = divisionRow("2nd Division A", 7, 0, true);
    expect(divisionTeamsComplete(div)).toBe(true);
  });

  it("divisionTeamsComplete rejects 7 teams without complete slots", () => {
    const div = divisionRow("2nd Division A", 7, 0, false);
    expect(divisionTeamsComplete(div)).toBe(false);
  });
});
