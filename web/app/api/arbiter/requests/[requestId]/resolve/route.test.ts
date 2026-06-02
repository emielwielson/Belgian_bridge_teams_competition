import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireRoles: vi.fn(),
  };
});

vi.mock("@/lib/competition/arbiter-request", () => ({
  resolveArbiterRequest: vi.fn(),
}));

vi.mock("@/lib/notifications/arbiter-request-email", () => ({
  sendArbiterRequestResolvedEmail: vi.fn(),
}));

import { requireRoles } from "@/lib/auth/route-auth";
import { resolveArbiterRequest } from "@/lib/competition/arbiter-request";
import { sendArbiterRequestResolvedEmail } from "@/lib/notifications/arbiter-request-email";

describe("/api/arbiter/requests/[requestId]/resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRoles).mockResolvedValue({
      user: { id: "arbiter-1" },
      roles: ["arbiter"],
      supabase: {} as never,
    });
  });

  it("resolves request and sends notification", async () => {
    const res = await POST(new Request("http://x", { method: "POST" }), {
      params: Promise.resolve({ requestId: "req-1" }),
    });

    expect(res.status).toBe(200);
    expect(resolveArbiterRequest).toHaveBeenCalledWith(expect.anything(), "req-1");
    expect(sendArbiterRequestResolvedEmail).toHaveBeenCalledWith({
      requestId: "req-1",
    });
  });
});
