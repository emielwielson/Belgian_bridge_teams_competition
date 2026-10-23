import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST, DELETE } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireRoles: vi.fn(),
  };
});

vi.mock("@/lib/auth/match-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/match-access")>();
  return {
    ...actual,
    loadMatchContext: vi.fn(),
    assertCanEditFinishedScoreForMatch: vi.fn(),
  };
});

vi.mock("@/lib/scoring/forfait", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scoring/forfait")>();
  return {
    ...actual,
    applyForfait: vi.fn(),
    clearForfait: vi.fn(),
  };
});

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateMatchDerivedViews: vi.fn(),
}));

import { requireRoles } from "@/lib/auth/route-auth";
import {
  loadMatchContext,
  assertCanEditFinishedScoreForMatch,
} from "@/lib/auth/match-access";
import { applyForfait, clearForfait } from "@/lib/scoring/forfait";
import { revalidateMatchDerivedViews } from "@/lib/competition/revalidate-standings";

const baseMatch = {
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
  forfait_side: null as "home" | "away" | null,
  home_lineup_locked_at: null,
  away_lineup_locked_at: null,
  home_team: { id: "home-1", name: "Home", club_id: "club-1" },
  away_team: { id: "away-1", name: "Away", club_id: "club-2" },
};

describe("POST /api/matches/[matchId]/forfait", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRoles).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["competition_manager"],
      supabase: {} as never,
    });
    vi.mocked(loadMatchContext).mockResolvedValue({ ...baseMatch });
    vi.mocked(assertCanEditFinishedScoreForMatch).mockResolvedValue(undefined);
    vi.mocked(applyForfait).mockResolvedValue({ vpHome: 0, vpAway: 14 });
    vi.mocked(revalidateMatchDerivedViews).mockResolvedValue(undefined);
  });

  it("applies forfait for the given side", async () => {
    vi.mocked(loadMatchContext)
      .mockResolvedValueOnce({ ...baseMatch })
      .mockResolvedValueOnce({
        ...baseMatch,
        forfait_side: "home",
        played_at: "2025-01-02T12:00:00Z",
        vp_home: 0,
        vp_away: 14,
      });

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ side: "home" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(applyForfait).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "match-1" }),
      "home",
      "user-1",
    );
    expect(body.match.forfait_side).toBe("home");
    expect(body.match.vp_home).toBe(0);
    expect(body.match.vp_away).toBe(14);
    expect(revalidateMatchDerivedViews).toHaveBeenCalled();
  });

  it("rejects invalid side", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ side: "both" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(400);
    expect(applyForfait).not.toHaveBeenCalled();
  });

  it("rejects when forfait already set", async () => {
    vi.mocked(loadMatchContext).mockResolvedValue({
      ...baseMatch,
      forfait_side: "away",
      played_at: "2025-01-02T12:00:00Z",
    });
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ side: "home" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(400);
    expect(applyForfait).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/matches/[matchId]/forfait", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRoles).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["competition_manager"],
      supabase: {} as never,
    });
    vi.mocked(assertCanEditFinishedScoreForMatch).mockResolvedValue(undefined);
    vi.mocked(clearForfait).mockResolvedValue(undefined);
    vi.mocked(revalidateMatchDerivedViews).mockResolvedValue(undefined);
  });

  it("clears an existing forfait", async () => {
    vi.mocked(loadMatchContext)
      .mockResolvedValueOnce({
        ...baseMatch,
        forfait_side: "home",
        played_at: "2025-01-02T12:00:00Z",
        vp_home: 0,
        vp_away: 12,
      })
      .mockResolvedValueOnce({ ...baseMatch });

    const res = await DELETE(new Request("http://x", { method: "DELETE" }), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    expect(res.status).toBe(200);
    expect(clearForfait).toHaveBeenCalled();
  });

  it("rejects when no forfait is set", async () => {
    vi.mocked(loadMatchContext).mockResolvedValue({ ...baseMatch });
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    expect(res.status).toBe(400);
    expect(clearForfait).not.toHaveBeenCalled();
  });
});
