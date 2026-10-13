import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST, PATCH } from "./route";

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
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

vi.mock("@/lib/competition/location-change", () => ({
  getMatchLocationChangeState: vi.fn(),
  proposeMatchLocationChange: vi.fn(),
  respondMatchLocationChange: vi.fn(),
  canAccessLocationChangeWorkflow: vi.fn(),
}));

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateMatchDerivedViews: vi.fn(),
}));

vi.mock("@/lib/notifications/location-change-email", () => ({
  sendLocationChangeProposedEmail: vi.fn(),
  sendLocationChangeDecisionEmail: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/route-auth";
import { loadMatchContext } from "@/lib/auth/match-access";
import {
  getMatchLocationChangeState,
  proposeMatchLocationChange,
  respondMatchLocationChange,
  canAccessLocationChangeWorkflow,
} from "@/lib/competition/location-change";
import { revalidateMatchDerivedViews } from "@/lib/competition/revalidate-standings";
import {
  sendLocationChangeDecisionEmail,
  sendLocationChangeProposedEmail,
} from "@/lib/notifications/location-change-email";

const baseState = {
  match_id: "match-1",
  datetime: "2025-06-01T12:00:00.000Z",
  played_at: null,
  home_team_id: "home-1",
  away_team_id: "away-1",
  location_override: null,
  captain_teams: ["home-1"],
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
  home_team: { id: "home-1", name: "Home FC", club_id: "c1" },
  away_team: { id: "away-1", name: "Away FC", club_id: "c2" },
};

describe("/api/matches/[matchId]/change-location", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: {} as never,
    });
    vi.mocked(canAccessLocationChangeWorkflow).mockReturnValue(true);
  });

  it("GET returns state when accessible", async () => {
    vi.mocked(getMatchLocationChangeState).mockResolvedValue(baseState);
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state.match_id).toBe("match-1");
  });

  it("POST proposes location change and emails", async () => {
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch as never);
    vi.mocked(proposeMatchLocationChange).mockResolvedValue("req-1");
    vi.mocked(getMatchLocationChangeState).mockResolvedValue({
      ...baseState,
      pending: {
        id: "req-1",
        proposed_location: "Club Hall",
        proposing_team_id: "home-1",
        proposed_by: "user-1",
        created_at: "2025-06-01T12:00:00.000Z",
      },
    });

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          proposing_team_id: "home-1",
          proposed_location: "Club Hall",
        }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );

    expect(res.status).toBe(200);
    expect(proposeMatchLocationChange).toHaveBeenCalledWith(
      {},
      "match-1",
      "Club Hall",
      "home-1",
    );
    expect(sendLocationChangeProposedEmail).toHaveBeenCalled();
  });

  it("PATCH approve revalidates and emails", async () => {
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch as never);
    vi.mocked(getMatchLocationChangeState)
      .mockResolvedValueOnce({
        ...baseState,
        pending: {
          id: "req-1",
          proposed_location: "Club Hall",
          proposing_team_id: "home-1",
          proposed_by: "user-1",
          created_at: "2025-06-01T12:00:00.000Z",
        },
      })
      .mockResolvedValueOnce({
        ...baseState,
        location_override: "Club Hall",
        pending: null,
      });
    vi.mocked(respondMatchLocationChange).mockResolvedValue();

    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ request_id: "req-1", action: "approve" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );

    expect(res.status).toBe(200);
    expect(revalidateMatchDerivedViews).toHaveBeenCalled();
    expect(sendLocationChangeDecisionEmail).toHaveBeenCalled();
  });
});
