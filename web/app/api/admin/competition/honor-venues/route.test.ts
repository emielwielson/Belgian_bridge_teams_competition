import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, PUT } from "./route";

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

vi.mock("@/lib/auth/competition-scope", () => ({
  assertManagesScopeRegion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/competition/ensure-national-structure", () => ({
  ensureNationalStructure: vi.fn().mockResolvedValue({
    leagueId: "league-1",
    divisionIds: new Map([["honor", "div-honor"]]),
  }),
}));

vi.mock("@/lib/competition/honor-match-day-venues", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/competition/honor-match-day-venues")
  >("@/lib/competition/honor-match-day-venues");
  return {
    ...actual,
    resolveHonorDivisionId: vi.fn().mockResolvedValue("div-honor"),
    loadHonorMatchDayVenues: vi.fn(),
    loadHonorMatchDays: vi.fn(),
    saveHonorMatchDayVenues: vi.fn(),
  };
});

describe("/api/admin/competition/honor-venues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns venues and match days", async () => {
    const { requireRoles } = await import("@/lib/auth/route-auth");
    const {
      loadHonorMatchDayVenues,
      loadHonorMatchDays,
    } = await import("@/lib/competition/honor-match-day-venues");

    vi.mocked(requireRoles).mockResolvedValue({
      supabase: {} as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });
    vi.mocked(loadHonorMatchDayVenues).mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
        matchDayIndex: i + 1,
        location: i === 0 ? "Hall A" : null,
      })),
    );
    vi.mocked(loadHonorMatchDays).mockResolvedValue([
      "2026-09-01",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.divisionId).toBe("div-honor");
    expect(body.venues).toHaveLength(7);
    expect(body.venues[0].location).toBe("Hall A");
    expect(body.matchDays[0]).toBe("2026-09-01");
    expect(body.complete).toBe(false);
  });

  it("PUT saves venues and allows clears", async () => {
    const { requireRoles } = await import("@/lib/auth/route-auth");
    const { saveHonorMatchDayVenues } = await import(
      "@/lib/competition/honor-match-day-venues"
    );

    vi.mocked(requireRoles).mockResolvedValue({
      supabase: {} as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });

    const venues = [
      "A",
      "",
      "C",
      "",
      "E",
      "F",
      "G",
    ];
    vi.mocked(saveHonorMatchDayVenues).mockResolvedValue(
      venues.map((location, i) => ({
        matchDayIndex: i + 1,
        location: location || null,
      })),
    );

    const res = await PUT(
      new Request("http://localhost/api/admin/competition/honor-venues", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venues }),
      }),
    );

    expect(res.status).toBe(200);
    expect(saveHonorMatchDayVenues).toHaveBeenCalledWith(
      expect.anything(),
      "div-honor",
      venues,
    );
    const body = await res.json();
    expect(body.venues[1].location).toBeNull();
    expect(body.complete).toBe(false);
  });

  it("PUT rejects wrong venue count", async () => {
    const { requireRoles } = await import("@/lib/auth/route-auth");
    vi.mocked(requireRoles).mockResolvedValue({
      supabase: {} as never,
      user: { id: "u1" } as never,
      roles: ["competition_manager"],
    });

    const res = await PUT(
      new Request("http://localhost/api/admin/competition/honor-venues", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venues: ["only-one"] }),
      }),
    );

    expect(res.status).toBe(400);
  });
});
