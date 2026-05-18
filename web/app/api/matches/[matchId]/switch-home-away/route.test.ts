import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST, PATCH } from "./route";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

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

vi.mock("@/lib/competition/home-away-switch", () => ({
  getMatchHomeAwaySwitchState: vi.fn(),
  proposeMatchHomeAwaySwitch: vi.fn(),
  respondMatchHomeAwaySwitch: vi.fn(),
  canAccessHomeAwaySwitchWorkflow: vi.fn(),
}));

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateStandingsForGroup: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/route-auth";
import { loadMatchContext } from "@/lib/auth/match-access";
import {
  getMatchHomeAwaySwitchState,
  proposeMatchHomeAwaySwitch,
  respondMatchHomeAwaySwitch,
  canAccessHomeAwaySwitchWorkflow,
} from "@/lib/competition/home-away-switch";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { revalidatePath } from "next/cache";

const baseState = {
  match_id: "match-1",
  round: 10,
  played_at: null,
  home_team_id: "home-1",
  away_team_id: "away-1",
  captain_teams: ["home-1"],
  needs_switch: true,
  is_mirror_round: true,
  first_leg_round: 3,
  first_leg: { home_team_id: "home-1", away_team_id: "away-1" },
  can_propose: true,
  can_approve: false,
  can_reject: false,
  can_cancel: false,
  pending: null,
};

const baseMatch = {
  id: "match-1",
  group_id: "group-1",
  round: 10,
  datetime: "2025-06-01T12:00:00.000Z",
  home_team_id: "home-1",
  away_team_id: "away-1",
  board_count: 24,
  imps_home: null,
  imps_away: null,
  vp_home: null,
  vp_away: null,
  played_at: null,
  home_team: { id: "home-1", name: "Home FC", club_id: "c1" },
  away_team: { id: "away-1", name: "Away FC", club_id: "c2" },
};

describe("/api/matches/[matchId]/switch-home-away", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: {} as never,
    });
    vi.mocked(canAccessHomeAwaySwitchWorkflow).mockReturnValue(true);
  });

  it("GET returns state when user may access workflow", async () => {
    vi.mocked(getMatchHomeAwaySwitchState).mockResolvedValue(baseState);
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.state.can_propose).toBe(true);
  });

  it("GET returns 403 when user cannot access workflow", async () => {
    vi.mocked(getMatchHomeAwaySwitchState).mockResolvedValue(baseState);
    vi.mocked(canAccessHomeAwaySwitchWorkflow).mockReturnValue(false);
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("POST proposes home/away switch", async () => {
    vi.mocked(proposeMatchHomeAwaySwitch).mockResolvedValue("req-1");
    vi.mocked(getMatchHomeAwaySwitchState).mockResolvedValue({
      ...baseState,
      can_propose: false,
      pending: {
        id: "req-1",
        requesting_team_id: "home-1",
        proposed_by: "user-1",
        created_at: "2025-01-01T00:00:00.000Z",
      },
    });

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ requesting_team_id: "home-1" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(200);
    expect(proposeMatchHomeAwaySwitch).toHaveBeenCalledWith(
      expect.anything(),
      "match-1",
      "home-1",
    );
  });

  it("PATCH approve revalidates standings and match page", async () => {
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch);
    vi.mocked(getMatchHomeAwaySwitchState).mockResolvedValue({
      ...baseState,
      needs_switch: false,
      home_team_id: "away-1",
      away_team_id: "home-1",
    });

    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ request_id: "req-1", action: "approve" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(200);
    expect(respondMatchHomeAwaySwitch).toHaveBeenCalledWith(
      expect.anything(),
      "req-1",
      "approve",
    );
    expect(revalidateStandingsForGroup).toHaveBeenCalledWith(
      expect.anything(),
      "group-1",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/player/matches/match-1");
  });
});
