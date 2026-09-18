import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireRoles: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/results/special-resolve", () => ({
  resolveHonorSpecialResult: vi.fn(),
}));

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateStandingsForGroup: vi.fn(),
}));

import { requireRoles } from "@/lib/auth/route-auth";
import { resolveHonorSpecialResult } from "@/lib/results/special-resolve";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";

describe("POST /api/arbiter/honor/results/[id]/resolve-special", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRoles).mockResolvedValue({
      user: { id: "u1" },
      roles: ["arbiter"],
      supabase: {},
    } as never);
  });

  it("resolves cancelled mode", async () => {
    vi.mocked(resolveHonorSpecialResult).mockResolvedValue({
      ok: true,
      resultId: "r1",
      boardId: "b1",
      groupId: "g1",
      tournamentRound: 1,
      matchScores: { refreshed: false, reason: "round_not_published" },
    });

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ mode: "cancelled", reason: "TD" }),
      }),
      { params: Promise.resolve({ id: "r1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(resolveHonorSpecialResult).toHaveBeenCalledWith(
      expect.objectContaining({
        resultId: "r1",
        input: expect.objectContaining({
          specialResultKind: "NOT_PLAYED",
          adjustmentMode: "cancelled",
          includedInMatchScore: false,
        }),
      }),
    );
    expect(revalidateStandingsForGroup).not.toHaveBeenCalled();
  });

  it("revalidates when match scores refreshed", async () => {
    vi.mocked(resolveHonorSpecialResult).mockResolvedValue({
      ok: true,
      resultId: "r1",
      boardId: "b1",
      groupId: "g1",
      tournamentRound: 1,
      matchScores: {
        refreshed: true,
        scores: [
          {
            matchId: "m1",
            impsHome: 1,
            impsAway: 0,
            vpHome: 11,
            vpAway: 9,
          },
        ],
      },
    });

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          mode: "artificial",
          adminAdjustedNsScore: 100,
          datumEligible: true,
        }),
      }),
      { params: Promise.resolve({ id: "r1" }) },
    );
    expect(res.status).toBe(200);
    expect(revalidateStandingsForGroup).toHaveBeenCalledWith(
      expect.anything(),
      "g1",
    );
  });
});
