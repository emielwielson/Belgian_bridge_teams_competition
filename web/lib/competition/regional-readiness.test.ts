import { describe, expect, it } from "vitest";
import {
  buildRegionalReadiness,
  countRegionalCalendarDates,
  groupTeamsComplete,
  hasPartialSchedules,
  REGIONAL_MIN_TEAMS,
  REGIONAL_SLOT_TEAM_MAX,
  schedulesReadyToStartOrResume,
  type GroupReadiness,
} from "./regional-readiness";

function groupRow(
  overrides: Partial<GroupReadiness> & Pick<GroupReadiness, "divisionName" | "groupName" | "groupId">,
): GroupReadiness {
  return {
    teamCount: 8,
    roundCount: 14,
    matchesCount: 0,
    teamsComplete: true,
    datesComplete: true,
    slotsComplete: true,
    scheduleComplete: false,
    groupReady: true,
    ...overrides,
  };
}

describe("regional-readiness", () => {
  it("counts regional calendar dates", () => {
    expect(countRegionalCalendarDates(14)).toEqual({
      required: 14,
      set: 14,
      complete: true,
    });
    expect(countRegionalCalendarDates(6)).toEqual({
      required: 14,
      set: 6,
      complete: false,
    });
  });

  it("groupTeamsComplete requires slots for 7–8 teams", () => {
    expect(
      groupTeamsComplete(
        groupRow({ teamCount: 8, slotsComplete: true, teamsComplete: true }),
      ),
    ).toBe(true);
    expect(
      groupTeamsComplete(
        groupRow({ teamCount: 8, slotsComplete: false, teamsComplete: false }),
      ),
    ).toBe(false);
    expect(
      groupTeamsComplete(groupRow({ teamCount: 6, slotsComplete: false })),
    ).toBe(true);
    expect(
      groupTeamsComplete(groupRow({ teamCount: 1, slotsComplete: false })),
    ).toBe(false);
  });

  it("canStartLeague when calendar and all groups ready without fixtures", () => {
    const result = buildRegionalReadiness({
      seasonStatus: "setup",
      regionCode: "flanders",
      leagueId: "league-1",
      rostersLocked: false,
      calendarRoundCount: 14,
      groups: [
        groupRow({
          divisionName: "2nd A",
          groupName: "A",
          groupId: "g1",
        }),
      ],
    });

    expect(result.allGroupsReady).toBe(true);
    expect(result.canStartLeague).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("blocks when calendar or groups incomplete", () => {
    const result = buildRegionalReadiness({
      seasonStatus: "setup",
      regionCode: "flanders",
      leagueId: "league-1",
      calendarRoundCount: 10,
      groups: [
        groupRow({
          divisionName: "2nd A",
          groupName: "A",
          groupId: "g1",
          teamCount: 4,
          teamsComplete: true,
          datesComplete: false,
          groupReady: false,
        }),
      ],
    });

    expect(result.canStartLeague).toBe(false);
    expect(result.blockers.some((b) => b.includes("Regional match days"))).toBe(
      true,
    );
    expect(result.blockers.some((b) => b.includes("date selection"))).toBe(
      true,
    );
  });

  it("blocks when no groups exist", () => {
    const result = buildRegionalReadiness({
      seasonStatus: "setup",
      regionCode: "wallonia",
      leagueId: "league-1",
      rostersLocked: false,
      calendarRoundCount: 14,
      groups: [],
    });

    expect(result.allGroupsReady).toBe(false);
    expect(result.canStartLeague).toBe(false);
    expect(
      result.blockers.some((b) => b.includes("at least one division")),
    ).toBe(true);
  });

  it("canStartLeague when some groups already have fixtures (resume)", () => {
    const groups = [
      groupRow({
        divisionName: "Liga 1",
        groupName: "A",
        groupId: "g1",
        matchesCount: 42,
        scheduleComplete: true,
      }),
      groupRow({
        divisionName: "Liga 1",
        groupName: "B",
        groupId: "g2",
        matchesCount: 0,
        scheduleComplete: false,
      }),
    ];
    expect(hasPartialSchedules(groups)).toBe(true);
    expect(schedulesReadyToStartOrResume(groups)).toBe(true);

    const result = buildRegionalReadiness({
      seasonStatus: "setup",
      regionCode: "flanders",
      leagueId: "league-1",
      rostersLocked: false,
      calendarRoundCount: 14,
      groups,
    });

    expect(result.canStartLeague).toBe(true);
    expect(result.allSchedulesReady).toBe(false);
  });

  it("accepts small groups with min teams", () => {
    const g = groupRow({
      divisionName: "3rd",
      groupName: "B",
      groupId: "g2",
      teamCount: REGIONAL_MIN_TEAMS,
      slotsComplete: false,
    });
    expect(g.teamCount).toBeLessThan(REGIONAL_SLOT_TEAM_MAX);
    expect(groupTeamsComplete(g)).toBe(true);
  });
});
