import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureNationalStructure, fetchNationalReadiness, generateGroupScheduleInDb } =
  vi.hoisted(() => ({
    ensureNationalStructure: vi.fn(),
    fetchNationalReadiness: vi.fn(),
    generateGroupScheduleInDb: vi.fn(),
  }));

vi.mock("./ensure-national-structure", () => ({
  ensureNationalStructure,
}));

vi.mock("./national-readiness", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./national-readiness")>();
  return {
    ...actual,
    fetchNationalReadiness,
  };
});

vi.mock("@/lib/scheduling/generate-group-schedule-db", () => ({
  generateGroupScheduleInDb,
}));

vi.mock("@/lib/scoring/standard-vp-bands", () => ({
  ensureVpTablesForGroup: vi.fn().mockResolvedValue(undefined),
}));

import { NationalNotReadyError } from "./national-readiness";
import { startNationalLeague } from "./start-national-league";

describe("startNationalLeague", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureNationalStructure.mockResolvedValue({ leagueId: "league-1" });
    generateGroupScheduleInDb.mockResolvedValue({ matchesCreated: 84, rounds: 14 });
  });

  it("throws when readiness checks fail", async () => {
    fetchNationalReadiness.mockResolvedValue({
      canStartLeague: false,
      blockers: ["Honor: 4/8 teams."],
      divisions: [],
    });

    await expect(
      startNationalLeague({} as never, "season-1"),
    ).rejects.toThrow(
      NationalNotReadyError,
    );
    expect(generateGroupScheduleInDb).not.toHaveBeenCalled();
  });

  it("generates all group schedules and activates season", async () => {
    fetchNationalReadiness.mockResolvedValue({
      canStartLeague: true,
      blockers: [],
      divisions: [
        { name: "Honor Division", groupId: "g1", scheduleComplete: false },
        { name: "1st Division", groupId: "g2", scheduleComplete: true },
      ],
    });

    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const groupsUpdate = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const from = vi.fn((table: string) => {
      if (table === "seasons") return { update };
      if (table === "leagues") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ id: "league-1" }] }),
            }),
          }),
        };
      }
      if (table === "divisions") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [{ id: "d1" }] }),
          }),
        };
      }
      if (table === "groups") return { update: groupsUpdate };
      return {};
    });

    const result = await startNationalLeague({ from } as never, "season-1");

    expect(ensureNationalStructure).toHaveBeenCalled();
    expect(generateGroupScheduleInDb).toHaveBeenCalledTimes(1);
    expect(generateGroupScheduleInDb).toHaveBeenCalledWith(
      expect.anything(),
      "g1",
      16,
    );
    expect(result.activated).toBe(true);
    expect(result.schedules).toHaveLength(2);
  });
});
