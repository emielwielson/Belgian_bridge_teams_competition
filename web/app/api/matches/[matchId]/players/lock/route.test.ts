import { describe, expect, it, vi, beforeEach } from "vitest";
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
  assertCanEditLineup: vi.fn(),
}));

vi.mock("@/lib/competition/honor-lineup-access", () => ({
  loadHonorMatchLineupContext: vi.fn(),
  resolveHonorViewerSide: vi.fn(),
}));

vi.mock("@/lib/scoring/match-operations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/scoring/match-operations")>();
  return {
    ...actual,
    getMatchLineup: vi.fn(),
    setMatchLineupLockedAt: vi.fn(),
  };
});

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidatePlayersForMatch: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/route-auth";
import { assertCanEditLineup, loadMatchContext } from "@/lib/auth/match-access";
import {
  loadHonorMatchLineupContext,
  resolveHonorViewerSide,
} from "@/lib/competition/honor-lineup-access";
import {
  getMatchLineup,
  setMatchLineupLockedAt,
} from "@/lib/scoring/match-operations";

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
  home_lineup_locked_at: null,
  away_lineup_locked_at: null,
  home_team: { id: "home-1", name: "Home", club_id: "club-1" },
  away_team: { id: "away-1", name: "Away", club_id: "club-2" },
};

const completeAwaySeats = [
  {
    id: "1",
    team_id: "away-1",
    player_id: "a",
    is_substitute: false,
    room: "open" as const,
    direction: "E" as const,
    player: { id: "a", name: "A", member_number: null },
  },
  {
    id: "2",
    team_id: "away-1",
    player_id: "b",
    is_substitute: false,
    room: "open" as const,
    direction: "W" as const,
    player: { id: "b", name: "B", member_number: null },
  },
  {
    id: "3",
    team_id: "away-1",
    player_id: "c",
    is_substitute: false,
    room: "closed" as const,
    direction: "N" as const,
    player: { id: "c", name: "C", member_number: null },
  },
  {
    id: "4",
    team_id: "away-1",
    player_id: "d",
    is_substitute: false,
    room: "closed" as const,
    direction: "S" as const,
    player: { id: "d", name: "D", member_number: null },
  },
];

describe("POST /api/matches/[matchId]/players/lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: {} as never,
    });
    vi.mocked(loadMatchContext).mockResolvedValue(baseMatch);
    vi.mocked(assertCanEditLineup).mockResolvedValue(undefined);
    vi.mocked(loadHonorMatchLineupContext).mockResolvedValue({
      isHonor: true,
      phase: "sequential",
      roundsPerRr: 7,
      roundCount: 21,
      homeLocked: false,
      awayLocked: false,
      venueTables: { openTable: 1, closedTable: 2 },
    });
    vi.mocked(resolveHonorViewerSide).mockResolvedValue("away");
    vi.mocked(getMatchLineup).mockResolvedValue(completeAwaySeats);
    vi.mocked(setMatchLineupLockedAt).mockResolvedValue(undefined);
  });

  it("locks away lineup when seats are complete", async () => {
    vi.mocked(loadMatchContext)
      .mockResolvedValueOnce(baseMatch)
      .mockResolvedValueOnce({
        ...baseMatch,
        away_lineup_locked_at: "2026-01-01T12:00:00Z",
      });

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ team_id: "away-1" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(200);
    expect(setMatchLineupLockedAt).toHaveBeenCalledWith(
      expect.anything(),
      "match-1",
      "away",
      expect.any(String),
    );
  });

  it("rejects home lock before away in sequential mode", async () => {
    vi.mocked(resolveHonorViewerSide).mockResolvedValue("home");
    vi.mocked(getMatchLineup).mockResolvedValue(
      completeAwaySeats.map((r) => ({
        ...r,
        team_id: "home-1",
        room:
          r.direction === "E"
            ? "closed"
            : r.direction === "W"
              ? "closed"
              : "open",
        direction:
          r.direction === "E"
            ? "E"
            : r.direction === "W"
              ? "W"
              : r.direction === "N"
                ? "N"
                : "S",
      })),
    );
    // Proper home seats
    vi.mocked(getMatchLineup).mockResolvedValue([
      {
        id: "1",
        team_id: "home-1",
        player_id: "a",
        is_substitute: false,
        room: "open",
        direction: "N",
        player: { id: "a", name: "A", member_number: null },
      },
      {
        id: "2",
        team_id: "home-1",
        player_id: "b",
        is_substitute: false,
        room: "open",
        direction: "S",
        player: { id: "b", name: "B", member_number: null },
      },
      {
        id: "3",
        team_id: "home-1",
        player_id: "c",
        is_substitute: false,
        room: "closed",
        direction: "E",
        player: { id: "c", name: "C", member_number: null },
      },
      {
        id: "4",
        team_id: "home-1",
        player_id: "d",
        is_substitute: false,
        room: "closed",
        direction: "W",
        player: { id: "d", name: "D", member_number: null },
      },
    ]);

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ team_id: "home-1" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(403);
    expect(setMatchLineupLockedAt).not.toHaveBeenCalled();
  });

  it("rejects lock when seats incomplete", async () => {
    vi.mocked(getMatchLineup).mockResolvedValue(completeAwaySeats.slice(0, 2));
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ team_id: "away-1" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(400);
  });
});
