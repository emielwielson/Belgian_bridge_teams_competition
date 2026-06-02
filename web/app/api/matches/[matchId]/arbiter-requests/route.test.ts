import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

vi.mock("@/lib/competition/arbiter-request", () => ({
  getMatchArbiterRequestsState: vi.fn(),
  createArbiterRequest: vi.fn(),
  canAccessArbiterRequestWorkflow: vi.fn(),
}));

vi.mock("@/lib/notifications/arbiter-request-email", () => ({
  sendArbiterRequestCreatedEmail: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/route-auth";
import {
  canAccessArbiterRequestWorkflow,
  createArbiterRequest,
  getMatchArbiterRequestsState,
} from "@/lib/competition/arbiter-request";
import { sendArbiterRequestCreatedEmail } from "@/lib/notifications/arbiter-request-email";

const baseState = {
  match_id: "match-1",
  can_submit: true,
  requests: [],
};

describe("/api/matches/[matchId]/arbiter-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: {} as never,
    });
    vi.mocked(canAccessArbiterRequestWorkflow).mockReturnValue(true);
  });

  it("GET returns state when user may access workflow", async () => {
    vi.mocked(getMatchArbiterRequestsState).mockResolvedValue(baseState);
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.state.can_submit).toBe(true);
  });

  it("POST submits with image_path only", async () => {
    vi.mocked(createArbiterRequest).mockResolvedValue("req-1");
    vi.mocked(getMatchArbiterRequestsState).mockResolvedValue({
      ...baseState,
      can_submit: false,
      requests: [
        {
          id: "req-1",
          board: null,
          description: null,
          image_path: "arbiter/match-1/file.pdf",
          status: "open",
          created_at: "2025-01-01T00:00:00.000Z",
          resolved_at: null,
        },
      ],
    });

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ image_path: "arbiter/match-1/file.pdf" }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );

    expect(res.status).toBe(200);
    expect(createArbiterRequest).toHaveBeenCalledWith(
      expect.anything(),
      "match-1",
      "arbiter/match-1/file.pdf",
    );
    expect(sendArbiterRequestCreatedEmail).toHaveBeenCalledWith({
      matchId: "match-1",
    });
  });

  it("POST returns 400 when image_path is missing", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(400);
    expect(createArbiterRequest).not.toHaveBeenCalled();
  });
});
