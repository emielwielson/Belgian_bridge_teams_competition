import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

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

describe("GET /api/admin/competition/clubs/[clubId]/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns club members for active season", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
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
  });
});
