import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadGroupScoringContext } from "@/lib/competition/match-scoring-context";
import { loadTeamsForUser } from "@/lib/competition/team-queries";
import { isPlayerOnHonorTeam } from "./team-access";

vi.mock("@/lib/competition/team-queries", () => ({
  loadTeamsForUser: vi.fn(),
}));

vi.mock("@/lib/competition/match-scoring-context", () => ({
  loadGroupScoringContext: vi.fn(),
}));

describe("isPlayerOnHonorTeam", () => {
  beforeEach(() => {
    vi.mocked(loadTeamsForUser).mockReset();
    vi.mocked(loadGroupScoringContext).mockReset();
  });

  it("returns false when the user has no teams", async () => {
    vi.mocked(loadTeamsForUser).mockResolvedValue([]);

    await expect(
      isPlayerOnHonorTeam({} as never, "user-1"),
    ).resolves.toBe(false);
    expect(loadGroupScoringContext).not.toHaveBeenCalled();
  });

  it("returns true when a roster team is national honor", async () => {
    vi.mocked(loadTeamsForUser).mockResolvedValue([
      { id: "team-1", name: "Alpha" },
      { id: "team-2", name: "Honor side" },
    ]);
    vi.mocked(loadGroupScoringContext)
      .mockResolvedValueOnce({
        groupId: "other-group",
        divisionLevelId: "dl-1",
        leagueScope: "national",
        divisionLevelCode: "first",
      })
      .mockResolvedValueOnce({
        groupId: "honor-group",
        divisionLevelId: "dl-honor",
        leagueScope: "national",
        divisionLevelCode: "honor",
      });

    const supabase = {
      from: (table: string) => {
        if (table !== "teams") throw new Error(`unexpected ${table}`);
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  { group_id: "other-group" },
                  { group_id: "honor-group" },
                ],
                error: null,
              }),
          }),
        };
      },
    } as never;

    await expect(isPlayerOnHonorTeam(supabase, "user-1")).resolves.toBe(true);
    expect(loadTeamsForUser).toHaveBeenCalledWith(supabase, "user-1");
  });

  it("returns false for regional honor-coded groups", async () => {
    vi.mocked(loadTeamsForUser).mockResolvedValue([
      { id: "team-1", name: "Liga" },
    ]);
    vi.mocked(loadGroupScoringContext).mockResolvedValue({
      groupId: "liga-group",
      divisionLevelId: "dl-honor",
      leagueScope: "regional",
      divisionLevelCode: "honor",
    });

    const supabase = {
      from: (table: string) => {
        if (table !== "teams") throw new Error(`unexpected ${table}`);
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [{ group_id: "liga-group" }],
                error: null,
              }),
          }),
        };
      },
    } as never;

    await expect(isPlayerOnHonorTeam(supabase, "user-1")).resolves.toBe(false);
  });

  it("returns false when the player is only on non-honor teams", async () => {
    vi.mocked(loadTeamsForUser).mockResolvedValue([
      { id: "team-1", name: "First" },
    ]);
    vi.mocked(loadGroupScoringContext).mockResolvedValue({
      groupId: "first-division",
      divisionLevelId: "dl-1",
      leagueScope: "national",
      divisionLevelCode: "first",
    });

    const supabase = {
      from: (table: string) => {
        if (table !== "teams") throw new Error(`unexpected ${table}`);
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [{ group_id: "first-division" }],
                error: null,
              }),
          }),
        };
      },
    } as never;

    await expect(isPlayerOnHonorTeam(supabase, "user-1")).resolves.toBe(false);
  });
});
