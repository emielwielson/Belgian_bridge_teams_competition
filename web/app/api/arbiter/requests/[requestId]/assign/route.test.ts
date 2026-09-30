import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
}));

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
  assignArbiterRequest: vi.fn(),
}));

vi.mock("@/lib/notifications/arbiter-request-email", () => ({
  sendArbiterRequestAssignedEmail: vi.fn().mockResolvedValue(undefined),
}));

import { assertArbiterInboxApiAccess } from "@/lib/auth/arbiter-scope";
import { requireRoles } from "@/lib/auth/route-auth";
import { assignArbiterRequest } from "@/lib/competition/arbiter-request";
import { sendArbiterRequestAssignedEmail } from "@/lib/notifications/arbiter-request-email";

describe("/api/arbiter/requests/[requestId]/assign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRoles).mockResolvedValue({
      user: { id: "manager-1" },
      roles: ["competition_manager"],
      supabase: {} as never,
    });
    vi.mocked(assertArbiterInboxApiAccess).mockResolvedValue(undefined);
    vi.mocked(assignArbiterRequest).mockResolvedValue(undefined);
  });

  it("assigns an arbiter and sends email", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arbiter_user_id: "arbiter-2" }),
      }),
      { params: Promise.resolve({ requestId: "req-1" }) },
    );

    expect(res.status).toBe(200);
    expect(assignArbiterRequest).toHaveBeenCalledWith(
      expect.anything(),
      "req-1",
      "arbiter-2",
    );
    expect(sendArbiterRequestAssignedEmail).toHaveBeenCalledWith(
      { requestId: "req-1", assignedArbiterId: "arbiter-2" },
      "en",
    );
    await expect(res.json()).resolves.toEqual({
      assigned: true,
      assignedArbiterId: "arbiter-2",
    });
  });

  it("rejects missing arbiter id", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ requestId: "req-1" }) },
    );

    expect(res.status).toBe(400);
    expect(assignArbiterRequest).not.toHaveBeenCalled();
  });
});
