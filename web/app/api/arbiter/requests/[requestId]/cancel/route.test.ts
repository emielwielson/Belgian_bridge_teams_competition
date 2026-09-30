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
  assertArbiterInboxApiAccess: vi.fn(),
}));

vi.mock("@/lib/competition/arbiter-request", () => ({
  cancelArbiterRequest: vi.fn(),
}));

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateStandingsForGroup: vi.fn(),
}));

import { assertArbiterInboxApiAccess } from "@/lib/auth/arbiter-scope";
import { requireRoles } from "@/lib/auth/route-auth";
import { cancelArbiterRequest } from "@/lib/competition/arbiter-request";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";

const mockFrom = vi.fn();

describe("/api/arbiter/requests/[requestId]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "req-1",
              match: { group_id: "group-1" },
            },
            error: null,
          }),
        })),
      })),
    }));
    vi.mocked(requireRoles).mockResolvedValue({
      user: { id: "manager-1" },
      roles: ["competition_manager"],
      supabase: { from: mockFrom } as never,
    });
    vi.mocked(assertArbiterInboxApiAccess).mockResolvedValue(undefined);
    vi.mocked(cancelArbiterRequest).mockResolvedValue(undefined);
  });

  it("cancels an open request", async () => {
    const res = await POST(new Request("http://x", { method: "POST" }), {
      params: Promise.resolve({ requestId: "req-1" }),
    });

    expect(res.status).toBe(200);
    expect(assertArbiterInboxApiAccess).toHaveBeenCalled();
    expect(cancelArbiterRequest).toHaveBeenCalledWith(expect.anything(), "req-1");
    expect(revalidateStandingsForGroup).toHaveBeenCalledWith(
      expect.anything(),
      "group-1",
    );
    await expect(res.json()).resolves.toEqual({ cancelled: true });
  });

  it("returns forbidden when cancel RPC rejects", async () => {
    vi.mocked(cancelArbiterRequest).mockRejectedValue(
      new Error("Only a competition manager may cancel requests"),
    );

    const res = await POST(new Request("http://x", { method: "POST" }), {
      params: Promise.resolve({ requestId: "req-1" }),
    });

    expect(res.status).toBe(500);
    expect(cancelArbiterRequest).toHaveBeenCalled();
  });
});
