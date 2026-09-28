import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireRoles: vi.fn(),
  };
});

vi.mock("@/lib/auth/competition-scope", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/competition-scope")>();
  return {
    ...actual,
    assertManagesClub: vi.fn().mockResolvedValue(undefined),
    assertManagesScopeRegion: vi.fn().mockResolvedValue(undefined),
  };
});

describe("GET /api/admin/competition/clubs/[clubId]/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active primary club members", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) =>
        resolve({
          data: [
            {
              player_id: "p1",
              player: { id: "p1", name: "Alice", member_number: "001" },
            },
            {
              player_id: "p2",
              player: { id: "p2", name: "Bob", member_number: null },
            },
          ],
          error: null,
        }),
    };

    const from = vi.fn(() => chain);

    const { requireRoles } = await import("@/lib/auth/route-auth");
    vi.mocked(requireRoles).mockResolvedValue({
      supabase: { from } as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ clubId: "c1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.players).toHaveLength(2);
    expect(body.players[0].name).toBe("Alice");
    expect(from).toHaveBeenCalledWith("player_club_memberships");
    expect(chain.eq).toHaveBeenCalledWith("club_id", "c1");
    expect(chain.eq).toHaveBeenCalledWith("membership_type", "primary");
    expect(chain.eq).toHaveBeenCalledWith("status", "active");
  });

  it("authorizes via Zweiffel scope and includes second/federation with active primary", async () => {
    const { assertManagesClub, assertManagesScopeRegion } = await import(
      "@/lib/auth/competition-scope"
    );

    let call = 0;
    const clubChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) =>
        resolve({
          data: [
            {
              player_id: "p1",
              membership_type: "primary",
              status: "active",
              player: { id: "p1", name: "Alice", member_number: "001" },
            },
            {
              player_id: "p2",
              membership_type: "second",
              status: "archived",
              player: { id: "p2", name: "Bob", member_number: null },
            },
            {
              player_id: "p3",
              membership_type: "federation",
              status: "active",
              player: { id: "p3", name: "Carla", member_number: null },
            },
            {
              player_id: "p4",
              membership_type: "primary",
              status: "archived",
              player: { id: "p4", name: "Skip", member_number: null },
            },
            {
              player_id: "p5",
              membership_type: "federation",
              status: "active",
              player: { id: "p5", name: "NoHome", member_number: null },
            },
          ],
          error: null,
        }),
    };
    const primaryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) =>
        resolve({
          data: [{ player_id: "p2" }, { player_id: "p3" }],
          error: null,
        }),
    };

    const from = vi.fn(() => {
      call += 1;
      return call === 1 ? clubChain : primaryChain;
    });
    const { requireRoles } = await import("@/lib/auth/route-auth");
    vi.mocked(requireRoles).mockResolvedValue({
      supabase: { from } as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });

    const res = await GET(
      new Request("http://localhost?kind=zweiffel"),
      { params: Promise.resolve({ clubId: "c1" }) },
    );
    expect(res.status).toBe(200);
    expect(assertManagesScopeRegion).toHaveBeenCalled();
    expect(assertManagesClub).not.toHaveBeenCalled();
    expect(clubChain.eq).toHaveBeenCalledWith("club_id", "c1");
    expect(clubChain.eq).not.toHaveBeenCalledWith("status", "active");
    const body = await res.json();
    expect(body.players.map((p: { name: string }) => p.name)).toEqual([
      "Alice",
      "Bob",
      "Carla",
    ]);
  });
});
