import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireRoles: vi.fn(),
  };
});

describe("GET /api/admin/competition/clubs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes soft-deleted clubs", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    const { requireRoles } = await import("@/lib/auth/route-auth");
    vi.mocked(requireRoles).mockResolvedValue({
      supabase: { from: vi.fn(() => chain) } as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });

    const res = await GET(new Request("http://localhost/api/admin/competition/clubs"));
    expect(res.status).toBe(200);
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
  });
});
