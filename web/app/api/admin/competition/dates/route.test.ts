import { describe, expect, it, vi, beforeEach } from "vitest";
import { PUT } from "./route";

vi.mock("@/lib/auth/route-auth", () => ({
  COMPETITION_ADMIN_ROLES: ["system_admin", "competition_manager"],
  requireRoles: vi.fn(),
}));

vi.mock("@/lib/competition/season", () => ({
  requireActiveSeason: vi.fn().mockResolvedValue({
    id: "season-1",
    name: "2025-26",
    status: "active",
    is_active: true,
  }),
}));

vi.mock("@/lib/competition/scope-setup", () => ({
  requireUnitInSetup: vi.fn().mockResolvedValue({
    id: "league-wallonia",
    status: "setup",
  }),
}));

vi.mock("@/lib/competition/queries", () => ({
  resolveRegionId: vi.fn().mockResolvedValue("region-wallonia"),
}));

vi.mock("@/lib/competition/match-dates-query", () => ({
  applyMatchDatesDivisionFilter: (q: unknown) => q,
  nationalMatchDatesDivisionId: vi.fn(),
}));

vi.mock("@/lib/time/brussels", () => ({
  parseBrusselsToUtc: (value: string) => value,
}));

describe("PUT /api/admin/competition/dates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows saving regional dates when season is active but league is in setup", async () => {
    const matchDays = Array.from({ length: 14 }, (_, i) => `2026-0${(i % 9) + 1}-15`);
    const insertSelect = vi.fn().mockResolvedValue({
      data: matchDays.map((day, index) => ({
        id: `date-${index}`,
        round: index + 1,
        datetime: day,
      })),
      error: null,
    });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const deleteQuery = {
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) => resolve({ error: null }),
    };

    const from = vi.fn((table: string) => {
      if (table === "competition_match_dates") {
        return {
          delete: vi.fn().mockReturnValue(deleteQuery),
          insert,
        };
      }
      return {};
    });

    const { requireRoles } = await import("@/lib/auth/route-auth");
    const { requireUnitInSetup } = await import("@/lib/competition/scope-setup");

    vi.mocked(requireRoles).mockResolvedValue({
      supabase: { from } as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });

    const res = await PUT(
      new Request("http://localhost/api/admin/competition/dates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "regional",
          region: "wallonia",
          matchDays,
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(requireUnitInSetup).toHaveBeenCalled();
    const body = await res.json();
    expect(body.dates).toHaveLength(14);
  });
});
