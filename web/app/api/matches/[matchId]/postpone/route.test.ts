import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST, PATCH } from "./route";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

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

vi.mock("@/lib/competition/postponement", () => ({
  getMatchPostponementState: vi.fn(),
  proposeMatchPostponement: vi.fn(),
  respondMatchPostponement: vi.fn(),
  canAccessPostponementWorkflow: vi.fn(),
}));

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateStandingsForGroup: vi.fn(),
}));

vi.mock("@/lib/notifications/postponement-email", () => ({
  sendPostponementProposedEmail: vi.fn(),
  sendPostponementDecisionEmail: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/route-auth";
import { loadMatchContext } from "@/lib/auth/match-access";
import {
  getMatchPostponementState,
  proposeMatchPostponement,
  respondMatchPostponement,
  canAccessPostponementWorkflow,
} from "@/lib/competition/postponement";
import { sendPostponementProposedEmail } from "@/lib/notifications/postponement-email";
import { sendPostponementDecisionEmail } from "@/lib/notifications/postponement-email";

const baseState = {
  match_id: "match-1",
  datetime: "2025-06-01T12:00:00.000Z",
  played_at: null,
  home_team_id: "home-1",
  away_team_id: "away-1",
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
  round: 3,
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
  home_team: { id: "home-1", name: "Home FC", club_id: "c1" },
  away_team: { id: "away-1", name: "Away FC", club_id: "c2" },
};

describe("/api/matches/[matchId]/postpone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: {} as never,
    });
    vi.mocked(canAccessPostponementWorkflow).mockReturnValue(true);
  });

  it("GET returns state when user may access workflow", async () => {
    vi.mocked(getMatchPostponementState).mockResolvedValue(baseState);
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.state.can_propose).toBe(true);
  });

  it("GET returns 403 when user cannot access workflow", async () => {
    vi.mocked(getMatchPostponementState).mockResolvedValue(baseState);
    vi.mocked(canAccessPostponementWorkflow).mockReturnValue(false);
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("POST proposes postponement", async () => {
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch);
    vi.mocked(proposeMatchPostponement).mockResolvedValue("req-1");
    vi.mocked(getMatchPostponementState).mockResolvedValue({
      ...baseState,
      can_propose: false,
      pending: {
        id: "req-1",
        proposed_datetime: "2025-06-10T14:00:00.000Z",
        proposing_team_id: "home-1",
        proposed_by: "user-1",
        created_at: "2025-01-01T00:00:00.000Z",
      },
    });

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          proposed_datetime: "2025-06-10T14:00",
          proposing_team_id: "home-1",
        }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(200);
    expect(proposeMatchPostponement).toHaveBeenCalled();
    expect(sendPostponementProposedEmail).toHaveBeenCalled();
  });

  it("PATCH approves postponement", async () => {
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch);
    vi.mocked(getMatchPostponementState)
      .mockResolvedValueOnce({
        ...baseState,
        pending: {
          id: "req-1",
          proposed_datetime: "2025-06-10T14:00:00.000Z",
          proposing_team_id: "home-1",
          proposed_by: "user-1",
          created_at: "2025-01-01T00:00:00.000Z",
        },
      })
      .mockResolvedValueOnce({ ...baseState, datetime: "2025-06-10T14:00:00.000Z" });

    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ request_id: "req-1", action: "approve" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(200);
    expect(respondMatchPostponement).toHaveBeenCalledWith(
      expect.anything(),
      "req-1",
      "approve",
    );
    expect(sendPostponementDecisionEmail).toHaveBeenCalledWith(
      expect.objectContaining({ action: "approve" }),
      "home-1",
      "away-1",
      "en",
    );
  });
});
