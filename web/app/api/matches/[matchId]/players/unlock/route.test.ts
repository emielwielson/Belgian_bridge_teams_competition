import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

vi.mock("@/lib/auth/match-access", () => ({
  loadMatchContext: vi.fn(),
}));

vi.mock("@/lib/competition/honor-lineup-access", () => ({
  loadHonorMatchLineupContext: vi.fn(),
  resolveHonorViewerSide: vi.fn(),
  canUnlockHonorLineup: vi.fn(),
}));

vi.mock("@/lib/scoring/match-operations", () => ({
  setMatchLineupLockedAt: vi.fn(),
}));

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidatePlayersForMatch: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: vi.fn(() => ({ service: true })),
}));

import { requireAuth } from "@/lib/auth/route-auth";
import { loadMatchContext } from "@/lib/auth/match-access";
import {
  canUnlockHonorLineup,
  loadHonorMatchLineupContext,
  resolveHonorViewerSide,
} from "@/lib/competition/honor-lineup-access";
import { setMatchLineupLockedAt } from "@/lib/scoring/match-operations";

const baseMatch = {
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
  home_lineup_locked_at: "2025-01-01T11:00:00Z",
  away_lineup_locked_at: "2025-01-01T11:00:00Z",
  home_team: { id: "home-1", name: "Home", club_id: "club-1" },
  away_team: { id: "away-1", name: "Away", club_id: "club-2" },
};

describe("POST /api/matches/[matchId]/players/unlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch as never);
    vi.mocked(loadHonorMatchLineupContext).mockResolvedValue({
      isHonor: true,
      phase: "sequential",
      roundsPerRr: 7,
      roundCount: 21,
      homeLocked: true,
      awayLocked: true,
      venueTables: { openTable: 1, closedTable: 2 },
    });
    vi.mocked(resolveHonorViewerSide).mockResolvedValue("other");
    vi.mocked(canUnlockHonorLineup).mockReturnValue(true);
    vi.mocked(setMatchLineupLockedAt).mockResolvedValue(undefined);
  });

  it("allows arbiter unlock via service client", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      supabase: {},
      user: { id: "arb1" },
      roles: ["arbiter"],
    } as never);

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ team_id: "home-1" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );

    expect(res.status).toBe(200);
    expect(setMatchLineupLockedAt).toHaveBeenCalledWith(
      { service: true },
      "match-1",
      "home",
      null,
    );
  });

  it("forbids unlock when canUnlockHonorLineup is false", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      supabase: {},
      user: { id: "p1" },
      roles: ["player"],
    } as never);
    vi.mocked(canUnlockHonorLineup).mockReturnValue(false);

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ team_id: "home-1" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );

    expect(res.status).toBe(403);
    expect(setMatchLineupLockedAt).not.toHaveBeenCalled();
  });
});
