import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth/route-auth", () => ({
  COMPETITION_ADMIN_ROLES: ["system_admin", "competition_manager"],
  requireRoles: vi.fn(),
}));

vi.mock("@/lib/competition/season", () => ({
  requireActiveSeason: vi.fn(),
}));

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateStandingsForTeam: vi.fn(),
}));

import { requireRoles } from "@/lib/auth/route-auth";
import { revalidateStandingsForTeam } from "@/lib/competition/revalidate-standings";

describe("POST /api/admin/penalties", () => {
  const insert = vi.fn();
  const select = vi.fn();
  const single = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    single.mockResolvedValue({
      data: {
        id: "p1",
        team_id: "t1",
        penalty_date: "2025-01-01",
        reason: "Late submission",
        vp_deduction: 2,
        created_at: "2025-01-01T00:00:00Z",
      },
      error: null,
    });
    select.mockReturnValue({ single });
    insert.mockReturnValue({ select });
    vi.mocked(requireRoles).mockResolvedValue({
      user: { id: "admin-1" },
      roles: ["competition_manager"],
      supabase: {
        from: vi.fn(() => ({ insert })),
      } as never,
    });
  });

  it("creates penalty and revalidates standings", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          team_id: "t1",
          penalty_date: "2025-01-01",
          reason: "Late submission",
          vp_deduction: 2,
        }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.penalty.team_id).toBe("t1");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: "t1",
        created_by: "admin-1",
      }),
    );
    expect(revalidateStandingsForTeam).toHaveBeenCalledWith(
      expect.anything(),
      "t1",
    );
  });
});
