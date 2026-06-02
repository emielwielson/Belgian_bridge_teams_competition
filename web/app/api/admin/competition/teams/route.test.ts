import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST, PATCH } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireRoles: vi.fn(),
  };
});

vi.mock("@/lib/competition/season", () => ({
  requireActiveSeason: vi.fn().mockResolvedValue({
    id: "season-1",
    name: "2025-26",
    status: "setup",
    is_active: true,
  }),
}));

vi.mock("@/lib/competition/season-setup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/competition/season-setup")>();
  return {
    ...actual,
    requireSeasonInSetup: vi.fn(),
  };
});

vi.mock("@/lib/competition/national-teams", () => ({
  isNationalGroup: vi.fn().mockResolvedValue(false),
  assertNationalGroupCanAddTeam: vi.fn().mockResolvedValue(undefined),
}));

describe("POST /api/admin/competition/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects create without captain_id", async () => {
    const { requireRoles } = await import("@/lib/auth/route-auth");
    vi.mocked(requireRoles).mockResolvedValue({
      supabase: { from: vi.fn() } as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          group_id: "g1",
          club_id: "c1",
          name: "Team A",
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("captain_id");
  });

  it("rejects captain who is not a club member", async () => {
    const membershipChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const from = vi.fn((table: string) => {
      if (table === "player_club_memberships") return membershipChain;
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
    });

    const { requireRoles } = await import("@/lib/auth/route-auth");
    vi.mocked(requireRoles).mockResolvedValue({
      supabase: { from } as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          group_id: "g1",
          club_id: "c1",
          name: "Team A",
          captain_id: "p-other",
        }),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("club");
  });

  it("creates team when captain is a club member", async () => {
    const membershipChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "m1" }, error: null }),
    };

    const insertChain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "t1",
          group_id: "g1",
          club_id: "c1",
          name: "Team A",
          captain_id: "p1",
        },
        error: null,
      }),
    };

    const from = vi.fn((table: string) => {
      if (table === "player_club_memberships") return membershipChain;
      if (table === "teams") {
        return { insert: vi.fn().mockReturnValue(insertChain) };
      }
      return {};
    });

    const { requireRoles } = await import("@/lib/auth/route-auth");
    vi.mocked(requireRoles).mockResolvedValue({
      supabase: { from } as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });

    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          group_id: "g1",
          club_id: "c1",
          name: "Team A",
          captain_id: "p1",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.team.captain_id).toBe("p1");
  });
});

describe("PATCH /api/admin/competition/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects captain not in team club", async () => {
    const teamChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "t1", club_id: "c1" },
        error: null,
      }),
    };

    const membershipChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const from = vi.fn((table: string) => {
      if (table === "teams") return teamChain;
      if (table === "player_club_memberships") return membershipChain;
      return {};
    });

    const { requireRoles } = await import("@/lib/auth/route-auth");
    vi.mocked(requireRoles).mockResolvedValue({
      supabase: { from } as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });

    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ id: "t1", captain_id: "p-bad" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
