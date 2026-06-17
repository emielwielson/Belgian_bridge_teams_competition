import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

vi.mock("@/lib/auth/team-access", () => ({
  assertCanManageTeamRoster: vi.fn(),
}));

vi.mock("@/lib/competition/season", () => ({
  requireActiveSeason: vi.fn(),
}));

vi.mock("@/lib/competition/team-roster", () => ({
  loadTeamRosterState: vi.fn(),
  addPlayerToTeamRoster: vi.fn(),
  removePlayerFromTeamRoster: vi.fn(),
}));

import { AuthError, requireAuth } from "@/lib/auth/route-auth";
import { assertCanManageTeamRoster } from "@/lib/auth/team-access";
import { requireActiveSeason } from "@/lib/competition/season";
import {
  addPlayerToTeamRoster,
  loadTeamRosterState,
  removePlayerFromTeamRoster,
} from "@/lib/competition/team-roster";

const season = { id: "season-1", name: "2025–26", status: "setup", is_active: true };

const rosterState = {
  roster: [{ player_id: "p1", name: "Alice", member_number: "001" }],
  available_players: [{ player_id: "p2", name: "Bob", member_number: "002" }],
};

function mockSupabase(team: { id: string; club_id: string } | null) {
  return {
    from: vi.fn((table: string) => {
      if (table === "teams") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: team,
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "player_club_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { id: "m1" }, error: null })),
                })),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("GET /api/teams/[teamId]/roster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: mockSupabase({ id: "team-1", club_id: "club-1" }) as never,
    });
    vi.mocked(loadTeamRosterState).mockResolvedValue({
      roster: [{ player_id: "p1", name: "Alice", member_number: "001" }],
      available_players: [],
    });
  });

  it("requires authentication", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError("Unauthorized", 401));

    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ teamId: "team-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns roster state for authorized captain", async () => {
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ teamId: "team-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.roster).toHaveLength(1);
    expect(assertCanManageTeamRoster).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      ["player"],
      "team-1",
      "club-1",
    );
  });

  it("returns 404 when team is missing", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: mockSupabase(null) as never,
    });

    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ teamId: "missing" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/teams/[teamId]/roster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: mockSupabase({ id: "team-1", club_id: "club-1" }) as never,
    });
    vi.mocked(requireActiveSeason).mockResolvedValue(season);
    vi.mocked(loadTeamRosterState).mockResolvedValue(rosterState);
  });

  it("adds a player to the roster", async () => {
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: "p2" }),
      }),
      { params: Promise.resolve({ teamId: "team-1" }) },
    );

    expect(res.status).toBe(201);
    expect(addPlayerToTeamRoster).toHaveBeenCalledWith(expect.anything(), {
      teamId: "team-1",
      playerId: "p2",
      seasonId: "season-1",
    });
    const body = await res.json();
    expect(body.roster).toHaveLength(1);
    expect(body.available_players).toHaveLength(1);
    expect(loadTeamRosterState).toHaveBeenCalledWith(
      expect.anything(),
      "team-1",
      "club-1",
    );
  });

  it("removes a player from the roster", async () => {
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "roster_remove", player_id: "p1" }),
      }),
      { params: Promise.resolve({ teamId: "team-1" }) },
    );

    expect(res.status).toBe(200);
    expect(removePlayerFromTeamRoster).toHaveBeenCalledWith(expect.anything(), {
      teamId: "team-1",
      playerId: "p1",
      seasonId: "season-1",
    });
    const body = await res.json();
    expect(body.roster).toHaveLength(1);
    expect(body.available_players).toHaveLength(1);
    expect(loadTeamRosterState).toHaveBeenCalledWith(
      expect.anything(),
      "team-1",
      "club-1",
    );
  });

  it("requires player_id", async () => {
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ teamId: "team-1" }) },
    );

    expect(res.status).toBe(400);
  });
});
