import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth/route-auth", () => ({
  COMPETITION_ADMIN_ROLES: ["system_admin", "competition_manager"],
  requireRoles: vi.fn(),
}));

vi.mock("@/lib/competition/season", () => ({
  requireActiveSeason: vi.fn().mockResolvedValue({
    id: "season-1",
    name: "2025-26",
    status: "setup",
    is_active: true,
  }),
}));

describe("GET /api/admin/competition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns season and leagues tree", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: undefined as unknown,
    };

    const from = vi.fn((table: string) => {
      if (table === "leagues") {
        return {
          ...chain,
          then: (resolve: (v: unknown) => void) =>
            resolve({
              data: [
                {
                  id: "l1",
                  name: "National",
                  scope: "national",
                  region_id: null,
                  season_id: "season-1",
                },
              ],
              error: null,
            }),
        };
      }
      if (table === "division_levels") {
        return {
          ...chain,
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: [], error: null }),
        };
      }
      if (table === "divisions") {
        return {
          ...chain,
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: [], error: null }),
        };
      }
      return chain;
    });

    const { requireRoles } = await import("@/lib/auth/route-auth");
    vi.mocked(requireRoles).mockResolvedValue({
      supabase: { from } as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });

    const res = await GET();
    const body = await res.json();
    expect(body.season.id).toBe("season-1");
    expect(body.leagues).toHaveLength(1);
  });
});
