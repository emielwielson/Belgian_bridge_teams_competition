import { describe, expect, it } from "vitest";
import {
  buildRbbfSchedule,
  assignTeamSlots,
  buildMatchRows,
} from "./generate-group-schedule";
import type { ScheduleSlotRow } from "@/lib/competition/group-schedule-slots";
import { RBBF_FIRST_LEG } from "./rbbf-8-team-template";

function slotAssignments(
  entries: Array<{ slot: number; teamId?: string; isBye?: boolean }>,
): ScheduleSlotRow[] {
  return Array.from({ length: 8 }, (_, i) => {
    const slot = i + 1;
    const entry = entries.find((e) => e.slot === slot);
    return {
      slot,
      teamId: entry?.isBye ? null : (entry?.teamId ?? null),
      isBye: entry?.isBye ?? false,
    };
  });
}

const dates = Array.from({ length: 14 }, (_, i) => ({
  round: i + 1,
  datetime: new Date(Date.UTC(2025, 8, i + 1, 14, 0)).toISOString(),
}));

describe("buildRbbfSchedule", () => {
  it("builds 56 matches for 8 teams without byes", () => {
    const teamIds = Array.from({ length: 8 }, (_, i) => `team-${i + 1}`);
    const teams = assignTeamSlots(teamIds);
    const { matches, byes } = buildRbbfSchedule(
      "group-1",
      teams,
      dates,
      24,
    );
    expect(matches).toHaveLength(56);
    expect(byes).toHaveLength(0);
  });

  it("matches buildMatchRows for 8 teams", () => {
    const teamIds = Array.from({ length: 8 }, (_, i) => `team-${i + 1}`);
    const teams = assignTeamSlots(teamIds);
    const legacy = buildMatchRows("group-1", teams, dates, 24);
    const { matches } = buildRbbfSchedule("group-1", teams, dates, 24);
    expect(matches).toEqual(legacy);
  });

  it("creates bye instead of match when bye is in slot 8", () => {
    const assignments = slotAssignments([
      { slot: 1, teamId: "t1" },
      { slot: 2, teamId: "t2" },
      { slot: 3, teamId: "t3" },
      { slot: 4, teamId: "t4" },
      { slot: 5, teamId: "t5" },
      { slot: 6, teamId: "t6" },
      { slot: 7, teamId: "t7" },
      { slot: 8, isBye: true },
    ]);

    const { matches, byes } = buildRbbfSchedule(
      "group-1",
      assignments,
      dates,
      24,
    );

    expect(byes.some((b) => b.round === 1 && b.team_id === "t7")).toBe(true);
    expect(
      matches.some(
        (m) =>
          (m.home_team_id === "t7" && m.away_team_id === "t8") ||
          (m.home_team_id === "t8" && m.away_team_id === "t7"),
      ),
    ).toBe(false);
    expect(matches.length).toBeLessThan(56);
  });

  it("creates bye for team paired with bye in slot 3 on round 6", () => {
    const assignments = slotAssignments([
      { slot: 1, teamId: "t1" },
      { slot: 2, teamId: "t2" },
      { slot: 3, isBye: true },
      { slot: 4, teamId: "t4" },
      { slot: 5, teamId: "t5" },
      { slot: 6, teamId: "t6" },
      { slot: 7, teamId: "t7" },
      { slot: 8, teamId: "t8" },
    ]);

    const { byes } = buildRbbfSchedule("group-1", assignments, dates, 24);
    const round6Pairing = RBBF_FIRST_LEG[5].find(
      (p) => p.home === 1 || p.away === 1 || p.home === 3 || p.away === 3,
    );
    expect(round6Pairing).toEqual({ home: 1, away: 3 });

    expect(byes.some((b) => b.round === 6 && b.team_id === "t1")).toBe(true);
  });
});
