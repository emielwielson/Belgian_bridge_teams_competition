import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertCanSubmitScore, type MatchContext } from "./match-access";
import { AuthError } from "./auth-error";

vi.mock("@/lib/competition/match-scoring-context", () => ({
  loadGroupScoringContext: vi.fn(),
}));

import { loadGroupScoringContext } from "@/lib/competition/match-scoring-context";

const baseMatch: MatchContext = {
  id: "match-1",
  group_id: "group-1",
  round: 1,
  datetime: "2025-01-01T12:00:00Z",
  home_team_id: "home-1",
  away_team_id: "away-1",
  board_count: 16,
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

describe("assertCanSubmitScore Honor gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects captain score entry for Honor Division", async () => {
    vi.mocked(loadGroupScoringContext).mockResolvedValue({
      groupId: "group-1",
      divisionLevelId: "dl-1",
      leagueScope: "national",
      divisionLevelCode: "honor",
    });

    await expect(
      assertCanSubmitScore({ rpc: vi.fn() } as never, baseMatch),
    ).rejects.toBeInstanceOf(AuthError);

    await expect(
      assertCanSubmitScore({ rpc: vi.fn() } as never, baseMatch),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Honor Division/i),
      status: 403,
    });
  });

  it("allows non-Honor when RPC permits and match unscored", async () => {
    vi.mocked(loadGroupScoringContext).mockResolvedValue({
      groupId: "group-1",
      divisionLevelId: "dl-1",
      leagueScope: "national",
      divisionLevelCode: "first",
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    };

    await expect(
      assertCanSubmitScore(supabase as never, baseMatch),
    ).resolves.toBeUndefined();
  });
});
