import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth/route-auth", () => ({
  requireRoles: vi.fn(),
}));

vi.mock("@/lib/competition/honor-seating-overview", () => ({
  resolveActiveHonorGroup: vi.fn(),
  loadHonorRoundMeta: vi.fn(),
  loadHonorRoundSeating: vi.fn(),
  defaultHonorRound: vi.fn(),
  honorRoundOptions: vi.fn(),
  matchDayForHonorRound: vi.fn(),
}));

import { requireRoles } from "@/lib/auth/route-auth";
import {
  defaultHonorRound,
  honorRoundOptions,
  loadHonorRoundMeta,
  loadHonorRoundSeating,
  matchDayForHonorRound,
  resolveActiveHonorGroup,
} from "@/lib/competition/honor-seating-overview";

describe("GET /api/arbiter/honor/round", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRoles).mockResolvedValue({
      supabase: {},
      user: { id: "u1" },
      roles: ["arbiter"],
    } as never);
    vi.mocked(resolveActiveHonorGroup).mockResolvedValue({
      id: "g1",
      round_count: 21,
      round_robin_count: 3,
    });
    vi.mocked(loadHonorRoundMeta).mockResolvedValue([
      { round: 1, datetime: "2026-01-01T10:00:00Z" },
    ]);
    vi.mocked(defaultHonorRound).mockReturnValue(1);
    vi.mocked(matchDayForHonorRound).mockReturnValue(1);
    vi.mocked(honorRoundOptions).mockReturnValue([
      { round: 1, matchDay: 1, slotIndex: 0, slotTime: "11:00" },
    ]);
    vi.mocked(loadHonorRoundSeating).mockResolvedValue({
      phase: "sequential",
      matches: [],
      tables: [],
    });
  });

  it("returns seating payload for a round", async () => {
    const res = await GET(
      new Request("http://localhost/api/arbiter/honor/round?round=1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.group_id).toBe("g1");
    expect(body.round).toBe(1);
    expect(body.can_unlock).toBe(true);
    expect(loadHonorRoundSeating).toHaveBeenCalledWith(
      {},
      { id: "g1", round_count: 21, round_robin_count: 3 },
      1,
    );
  });

  it("404 when Honor group missing", async () => {
    vi.mocked(resolveActiveHonorGroup).mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/arbiter/honor/round"),
    );
    expect(res.status).toBe(404);
  });
});
