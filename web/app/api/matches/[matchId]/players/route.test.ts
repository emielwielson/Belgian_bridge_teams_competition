import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, PUT } from "./route";

vi.mock("@/lib/auth/route-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/auth/match-access", () => ({
  loadMatchContext: vi.fn(),
  assertCanEditLineup: vi.fn(),
  assertCanViewMatchOps: vi.fn(),
}));

vi.mock("@/lib/scoring/match-operations", () => ({
  getMatchLineup: vi.fn(),
  replaceMatchLineup: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/route-auth";
import {
  loadMatchContext,
  assertCanEditLineup,
  assertCanViewMatchOps,
} from "@/lib/auth/match-access";
import {
  getMatchLineup,
  replaceMatchLineup,
} from "@/lib/scoring/match-operations";

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

const lineupRow = {
  id: "mp-1",
  team_id: "home-1",
  player_id: "p-1",
  is_substitute: false,
  player: { id: "p-1", name: "Alice", member_number: null },
};

describe("PUT /api/matches/[matchId]/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: {} as never,
    });
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch);
    vi.mocked(assertCanEditLineup).mockResolvedValue(undefined);
    vi.mocked(replaceMatchLineup).mockResolvedValue([lineupRow]);
  });

  it("replaces team lineup", async () => {
    const res = await PUT(
      new Request("http://x", {
        method: "PUT",
        body: JSON.stringify({
          team_id: "home-1",
          players: [{ player_id: "p-1", is_substitute: false }],
        }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(200);
    expect(replaceMatchLineup).toHaveBeenCalledWith(
      expect.anything(),
      "match-1",
      "home-1",
      [{ player_id: "p-1", is_substitute: false }],
    );
  });

  it("rejects invalid team_id", async () => {
    const res = await PUT(
      new Request("http://x", {
        method: "PUT",
        body: JSON.stringify({
          team_id: "other-team",
          players: [],
        }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/matches/[matchId]/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: {} as never,
    });
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch);
    vi.mocked(assertCanViewMatchOps).mockResolvedValue(undefined);
    vi.mocked(getMatchLineup).mockResolvedValue([lineupRow]);
  });

  it("returns grouped lineup", async () => {
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.lineup.home).toHaveLength(1);
    expect(body.lineup.away).toHaveLength(0);
  });
});
