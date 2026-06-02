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

vi.mock("@/lib/files/operational-file-storage", () => ({
  createOperationalSignedUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: vi.fn(),
}));

import { requireRoles } from "@/lib/auth/route-auth";
import { resolveArbiterRequest } from "@/lib/competition/arbiter-request";
import { createOperationalSignedUrl } from "@/lib/files/operational-file-storage";
import { sendArbiterRequestResolvedEmail } from "@/lib/notifications/arbiter-request-email";

describe("/api/arbiter/requests/[requestId]/resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRoles).mockResolvedValue({
      user: { id: "arbiter-1" },
      roles: ["arbiter"],
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { file_path: "rulings/m1/r.pdf" },
                error: null,
              }),
            })),
          })),
        })),
      } as never,
    });
    vi.mocked(resolveArbiterRequest).mockResolvedValue("ruling-1");
    vi.mocked(createOperationalSignedUrl).mockResolvedValue("https://signed/r.pdf");
  });

  it("requires ruling file_path", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ requestId: "req-1" }) },
    );

    expect(res.status).toBe(400);
    expect(resolveArbiterRequest).not.toHaveBeenCalled();
  });

  it("resolves request with ruling and sends notification", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: "rulings/m1/r.pdf", board: 2 }),
      }),
      { params: Promise.resolve({ requestId: "req-1" }) },
    );

    expect(res.status).toBe(200);
    expect(resolveArbiterRequest).toHaveBeenCalledWith(expect.anything(), "req-1", {
      filePath: "rulings/m1/r.pdf",
      board: 2,
      rulingDate: null,
    });
    expect(sendArbiterRequestResolvedEmail).toHaveBeenCalledWith({
      requestId: "req-1",
      rulingSignedUrl: "https://signed/r.pdf",
    });
  });
});
