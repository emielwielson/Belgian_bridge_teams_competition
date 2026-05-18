import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth/route-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/auth/match-access", () => ({
  loadMatchContext: vi.fn(),
  assertCanViewMatchOps: vi.fn(),
  assertCanEditLineup: vi.fn(),
}));

vi.mock("@/lib/competition/season", () => ({
  requireActiveSeason: vi.fn(),
}));

vi.mock("@/lib/competition/player-matches", () => ({
  loadClubSubCandidates: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/route-auth";
import {
  loadMatchContext,
  assertCanViewMatchOps,
  assertCanEditLineup,
} from "@/lib/auth/match-access";
import { requireActiveSeason } from "@/lib/competition/season";
import { loadClubSubCandidates } from "@/lib/competition/player-matches";

const baseMatch = {
  id: "match-1",
  home_team_id: "home-1",
  away_team_id: "away-1",
  home_team: { id: "home-1", name: "Home", club_id: "club-1" },
  away_team: { id: "away-1", name: "Away", club_id: "club-2" },
};

describe("GET /api/matches/[matchId]/sub-candidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: {} as never,
    });
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch as never);
    vi.mocked(assertCanViewMatchOps).mockResolvedValue(undefined);
    vi.mocked(assertCanEditLineup).mockResolvedValue(undefined);
    vi.mocked(requireActiveSeason).mockResolvedValue({
      id: "season-1",
      name: "2025-26",
      status: "active",
      is_active: true,
    });
    vi.mocked(loadClubSubCandidates).mockResolvedValue([
      { id: "sub-1", name: "Club Sub", member_number: null },
    ]);
  });

  it("returns club sub candidates for home team", async () => {
    const res = await GET(
      new Request("http://x?team_id=home-1"),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.players).toHaveLength(1);
    expect(loadClubSubCandidates).toHaveBeenCalledWith(
      expect.anything(),
      "club-1",
      "home-1",
      "season-1",
    );
  });

  it("requires team_id", async () => {
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    expect(res.status).toBe(400);
  });
});
