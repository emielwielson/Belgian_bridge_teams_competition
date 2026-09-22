import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireRoles: vi.fn(),
  };
});

vi.mock("@/lib/auth/arbiter-scope", () => ({
  assertArbiterHonorApiAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/results/special-resolve", () => ({
  resolveHonorSpecialResult: vi.fn(),
}));

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateStandingsForGroup: vi.fn(),
}));

vi.mock("@/lib/butler/revalidate-butler", () => ({
  revalidateButlerPublicPages: vi.fn(),
}));

import { requireRoles } from "@/lib/auth/route-auth";
import { resolveHonorSpecialResult } from "@/lib/results/special-resolve";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { revalidateButlerPublicPages } from "@/lib/butler/revalidate-butler";

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
    expect(revalidateButlerPublicPages).toHaveBeenCalled();
  });

  it("rejects artificial mode", async () => {
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
    expect(res.status).toBe(400);
    expect(resolveHonorSpecialResult).not.toHaveBeenCalled();
  });

  it("resolves multi-leg weighted mode and revalidates when match scores refresh", async () => {
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
          mode: "weighted",
          legs: [
            { score: 420, weightNs: 2, weightEw: 1 },
            { score: 50, weightNs: 1, weightEw: 1 },
            { score: 0, weightNs: 1, weightEw: 2 },
          ],
          datumEligible: true,
        }),
      }),
      { params: Promise.resolve({ id: "r1" }) },
    );
    expect(res.status).toBe(200);
    expect(resolveHonorSpecialResult).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          adjustmentMode: "weighted",
          adminAdjustedNsScore: 223,
          adminAdjustedEwScore: 118,
        }),
      }),
    );
    expect(revalidateStandingsForGroup).toHaveBeenCalledWith(
      expect.anything(),
      "g1",
    );
  });

  it("resolves split datum scores", async () => {
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
        body: JSON.stringify({
          mode: "split",
          adminAdjustedNsScore: 100,
          adminAdjustedEwScore: 40,
        }),
      }),
      { params: Promise.resolve({ id: "r1" }) },
    );
    expect(res.status).toBe(200);
    expect(resolveHonorSpecialResult).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          adjustmentMode: "split",
          adminAdjustedNsScore: 100,
          adminAdjustedEwScore: 40,
          adminNsButlerImps: null,
          adminEwButlerImps: null,
        }),
      }),
    );
  });

  it("resolves average_pm mode", async () => {
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
        body: JSON.stringify({
          mode: "average_pm",
          nsAward: "plus",
          ewAward: "minus",
          reason: "ruling",
        }),
      }),
      { params: Promise.resolve({ id: "r1" }) },
    );
    expect(res.status).toBe(200);
    expect(resolveHonorSpecialResult).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          adjustmentMode: "average_pm",
          specialResultKind: "ADJUSTED",
          includedInMatchScore: true,
          datumEligible: false,
          adminAdjustedNsScore: null,
          adjustmentMeta: expect.objectContaining({
            nsAward: "plus",
            ewAward: "minus",
          }),
        }),
      }),
    );
  });

  it("resolves average_pm with zero awards", async () => {
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
        body: JSON.stringify({
          mode: "average_pm",
          nsAward: "zero",
          ewAward: "zero",
        }),
      }),
      { params: Promise.resolve({ id: "r1" }) },
    );
    expect(res.status).toBe(200);
    expect(resolveHonorSpecialResult).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          adjustmentMode: "average_pm",
          adjustmentMeta: expect.objectContaining({
            nsAward: "zero",
            ewAward: "zero",
          }),
        }),
      }),
    );
  });
});
