import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertCanDisciplineTeam,
  canAddPenaltyForMatch,
  canEditFinishedScoreForMatch,
  canEditLineupForTeam,
  type MatchContext,
} from "./match-access";
import { AuthError } from "./auth-error";
import { ROLES } from "./roles";

vi.mock("@/lib/auth/arbiter-scope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./arbiter-scope")>();
  return {
    ...actual,
    userIsArbiterForMatch: vi.fn(),
    userIsArbiterForTeam: vi.fn(),
  };
});

vi.mock("@/lib/auth/competition-scope", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./competition-scope")>();
  return {
    ...actual,
    userManagesMatch: vi.fn(),
    userManagesTeam: vi.fn(),
  };
});

import {
  userIsArbiterForMatch,
  userIsArbiterForTeam,
} from "./arbiter-scope";
import { userManagesMatch, userManagesTeam } from "./competition-scope";

const baseMatch: MatchContext = {
  id: "match-1",
  group_id: "group-1",
  round: 1,
  datetime: "2025-01-01T12:00:00Z",
  home_team_id: "home-1",
  away_team_id: "away-1",
  board_count: 24,
  vp_board_count: null,
  mis_seating: false,
  selected_board_count: null,
  imps_home: null,
  imps_away: null,
  vp_home: null,
  vp_away: null,
  played_at: null,
  home_lineup_locked_at: null,
  away_lineup_locked_at: null,
  home_team: { id: "home-1", name: "Home", club_id: "club-1" },
  away_team: { id: "away-1", name: "Away", club_id: "club-2" },
};

function mockSupabase(options: {
  canEditLineup?: boolean;
  playerId?: string | null;
  rosterTeamIds?: string[];
}) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: options.canEditLineup ?? true,
      error: null,
    }),
    from: (table: string) => {
      if (table === "user_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: options.playerId
                    ? { active_player_id: options.playerId }
                    : { active_player_id: null },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "player_auth_links") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: options.playerId ? { player_id: options.playerId } : null,
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "team_players") {
        const roster = new Set(options.rosterTeamIds ?? []);
        return {
          select: () => ({
            eq: () => ({
              eq: (_col: string, teamId: string) => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: roster.has(teamId) ? { team_id: teamId } : null,
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as never;
}

describe("canEditLineupForTeam", () => {
  it("lets a match player edit both home and away lineups", async () => {
    const supabase = mockSupabase({
      playerId: "player-1",
      rosterTeamIds: [baseMatch.home_team_id],
    });

    await expect(
      canEditLineupForTeam(
        supabase,
        "user-1",
        [ROLES.PLAYER],
        baseMatch,
        baseMatch.home_team_id,
      ),
    ).resolves.toBe(true);
    await expect(
      canEditLineupForTeam(
        supabase,
        "user-1",
        [ROLES.PLAYER],
        baseMatch,
        baseMatch.away_team_id,
      ),
    ).resolves.toBe(true);
  });

  it("denies when match is already played", async () => {
    const supabase = mockSupabase({
      playerId: "player-1",
      rosterTeamIds: [baseMatch.home_team_id],
    });

    await expect(
      canEditLineupForTeam(
        supabase,
        "user-1",
        [ROLES.PLAYER],
        { ...baseMatch, played_at: "2025-01-02T12:00:00Z" },
        baseMatch.home_team_id,
      ),
    ).resolves.toBe(false);
  });
});

describe("match scope gates for arbiter discipline and finished scores", () => {
  const supabase = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("canAddPenaltyForMatch allows pure arbiter only for in-scope match", async () => {
    vi.mocked(userIsArbiterForMatch).mockResolvedValueOnce(true);
    await expect(
      canAddPenaltyForMatch(supabase, [ROLES.ARBITER], "match-1"),
    ).resolves.toBe(true);

    vi.mocked(userIsArbiterForMatch).mockResolvedValueOnce(false);
    await expect(
      canAddPenaltyForMatch(supabase, [ROLES.ARBITER], "match-2"),
    ).resolves.toBe(false);
    expect(userManagesMatch).not.toHaveBeenCalled();
  });

  it("canAddPenaltyForMatch uses manager scope for competition managers", async () => {
    vi.mocked(userManagesMatch).mockResolvedValueOnce(true);
    await expect(
      canAddPenaltyForMatch(
        supabase,
        [ROLES.COMPETITION_MANAGER],
        "match-1",
      ),
    ).resolves.toBe(true);
    expect(userIsArbiterForMatch).not.toHaveBeenCalled();

    vi.mocked(userManagesMatch).mockResolvedValueOnce(false);
    await expect(
      canAddPenaltyForMatch(
        supabase,
        [ROLES.COMPETITION_MANAGER],
        "match-2",
      ),
    ).resolves.toBe(false);
  });

  it("canAddPenaltyForMatch denies players", async () => {
    await expect(
      canAddPenaltyForMatch(supabase, [ROLES.PLAYER], "match-1"),
    ).resolves.toBe(false);
  });

  it("canEditFinishedScoreForMatch mirrors arbiter match scope", async () => {
    vi.mocked(userIsArbiterForMatch).mockResolvedValueOnce(false);
    await expect(
      canEditFinishedScoreForMatch(supabase, [ROLES.ARBITER], "match-1"),
    ).resolves.toBe(false);

    vi.mocked(userIsArbiterForMatch).mockResolvedValueOnce(true);
    await expect(
      canEditFinishedScoreForMatch(supabase, [ROLES.ARBITER], "match-1"),
    ).resolves.toBe(true);
  });

  it("assertCanDisciplineTeam allows pure arbiter for in-scope team", async () => {
    vi.mocked(userIsArbiterForTeam).mockResolvedValue(true);
    await expect(
      assertCanDisciplineTeam(supabase, [ROLES.ARBITER], "team-1"),
    ).resolves.toBeUndefined();
  });

  it("assertCanDisciplineTeam rejects pure arbiter out of scope", async () => {
    vi.mocked(userIsArbiterForTeam).mockResolvedValue(false);
    await expect(
      assertCanDisciplineTeam(supabase, [ROLES.ARBITER], "team-1"),
    ).rejects.toBeInstanceOf(AuthError);
    await expect(
      assertCanDisciplineTeam(supabase, [ROLES.ARBITER], "team-1"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("assertCanDisciplineTeam uses manager team scope", async () => {
    vi.mocked(userManagesTeam).mockResolvedValue(true);
    await expect(
      assertCanDisciplineTeam(
        supabase,
        [ROLES.COMPETITION_MANAGER],
        "team-1",
      ),
    ).resolves.toBeUndefined();
    expect(userIsArbiterForTeam).not.toHaveBeenCalled();

    vi.mocked(userManagesTeam).mockResolvedValue(false);
    await expect(
      assertCanDisciplineTeam(
        supabase,
        [ROLES.COMPETITION_MANAGER],
        "team-2",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
