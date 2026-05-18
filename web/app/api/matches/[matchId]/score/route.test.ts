import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST, PATCH } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireAuth: vi.fn(),
    requireRoles: vi.fn(),
  };
});

vi.mock("@/lib/auth/match-access", () => ({
  loadMatchContext: vi.fn(),
  assertCanSubmitScore: vi.fn(),
  assertCanViewMatchOps: vi.fn(),
  assertCanAdminEditScore: vi.fn(),
}));

vi.mock("@/lib/scoring/match-operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scoring/match-operations")>();
  return {
    ...actual,
    submitMatchScore: vi.fn(),
  };
});

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateStandingsForGroup: vi.fn(),
}));

import { requireAuth, requireRoles } from "@/lib/auth/route-auth";
import {
  loadMatchContext,
  assertCanSubmitScore,
  assertCanViewMatchOps,
  assertCanAdminEditScore,
} from "@/lib/auth/match-access";
import { submitMatchScore } from "@/lib/scoring/match-operations";

const baseMatch = {
  id: "match-1",
  group_id: "group-1",
  round: 1,
  datetime: "2025-01-01T12:00:00Z",
  home_team_id: "home-1",
  away_team_id: "away-1",
  board_count: 24,
  imps_home: null,
  imps_away: null,
  vp_home: null,
  vp_away: null,
  played_at: null,
  home_team: { id: "home-1", name: "Home", club_id: "club-1" },
  away_team: { id: "away-1", name: "Away", club_id: "club-2" },
};

describe("GET /api/matches/[matchId]/score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: {} as never,
    });
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch);
    vi.mocked(assertCanViewMatchOps).mockResolvedValue(undefined);
  });

  it("returns current score fields", async () => {
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.match.board_count).toBe(24);
    expect(body.match.played_at).toBeNull();
    expect(body.match.status).toBe("scheduled");
  });
});

describe("POST /api/matches/[matchId]/score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: {} as never,
    });
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch);
    vi.mocked(assertCanSubmitScore).mockResolvedValue(undefined);
    vi.mocked(submitMatchScore).mockResolvedValue({
      id: "match-1",
      imps_home: 10,
      imps_away: 5,
      vp_home: 24,
      vp_away: 0,
      played_at: "2025-01-02T12:00:00Z",
    });
  });

  it("returns 400 when lineups are incomplete", async () => {
    vi.mocked(submitMatchScore).mockRejectedValue(
      new Error("Home must have at least 4 players registered (has 0)"),
    );
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ imps_home: 10, imps_away: 5 }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("submits score and returns match", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ imps_home: 10, imps_away: 5 }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.match.vp_home).toBe(24);
    expect(body.match.status).toBe("played");
    expect(submitMatchScore).toHaveBeenCalledWith(
      expect.anything(),
      baseMatch,
      "user-1",
      { impsHome: 10, impsAway: 5 },
      { isAdminEdit: false },
    );
  });
});

describe("PATCH /api/matches/[matchId]/score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRoles).mockResolvedValue({
      user: { id: "admin-1" },
      roles: ["competition_manager"],
      supabase: {} as never,
    });
    vi.mocked(loadMatchContext).mockResolvedValue({
      ...baseMatch,
      played_at: "2025-01-02T12:00:00Z",
      imps_home: 10,
      imps_away: 5,
      vp_home: 24,
      vp_away: 0,
    });
    vi.mocked(submitMatchScore).mockResolvedValue({
      id: "match-1",
      imps_home: 12,
      imps_away: 8,
      vp_home: 24,
      vp_away: 0,
      played_at: "2025-01-02T12:00:00Z",
    });
  });

  it("allows admin overwrite", async () => {
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ imps_home: 12, imps_away: 8 }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(200);
    expect(assertCanAdminEditScore).toHaveBeenCalled();
    expect(submitMatchScore).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ played_at: "2025-01-02T12:00:00Z" }),
      "admin-1",
      { impsHome: 12, impsAway: 8 },
      expect.objectContaining({ isAdminEdit: true }),
    );
  });
});
