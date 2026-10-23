import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth/route-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/competition/player-matches", () => ({
  loadScorableMatchesForUser: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/route-auth";
import { loadScorableMatchesForUser } from "@/lib/competition/player-matches";

describe("GET /api/matches/scorable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: {} as never,
    });
  });

  it("returns scorable matches for authenticated user", async () => {
    vi.mocked(loadScorableMatchesForUser).mockResolvedValue([
      {
        id: "m1",
        round: 1,
        datetime: "2025-01-01T12:00:00Z",
        played_at: null,
        home_team: { id: "h1", name: "Home" },
        away_team: { id: "a1", name: "Away" },
        group_name: "Group A",
        status: "scheduled",
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].status).toBe("scheduled");
    expect(loadScorableMatchesForUser).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["player"],
    );
  });
});
