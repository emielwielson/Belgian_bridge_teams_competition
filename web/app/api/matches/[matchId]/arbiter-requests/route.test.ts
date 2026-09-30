import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
}));

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

vi.mock("@/lib/competition/arbiter-request", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/competition/arbiter-request")>();
  return {
    ...actual,
    loadMatchArbiterRequestsForUser: vi.fn(),
    createArbiterRequest: vi.fn(),
    canAccessArbiterRequestWorkflow: vi.fn(),
  };
});

vi.mock("@/lib/notifications/arbiter-request-email", () => ({
  sendArbiterRequestCreatedEmail: vi.fn(),
}));

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateStandingsForGroup: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/route-auth";
import {
  canAccessArbiterRequestWorkflow,
  createArbiterRequest,
  loadMatchArbiterRequestsForUser,
} from "@/lib/competition/arbiter-request";
import { sendArbiterRequestCreatedEmail } from "@/lib/notifications/arbiter-request-email";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";

const baseState = {
  match_id: "match-1",
  can_submit: true,
  requests: [],
};

function mockSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { group_id: "group-1" },
            error: null,
          }),
        })),
      })),
    })),
  };
}

describe("/api/matches/[matchId]/arbiter-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: "user-1" },
      roles: ["player"],
      supabase: mockSupabase() as never,
    });
    vi.mocked(canAccessArbiterRequestWorkflow).mockReturnValue(true);
  });

  it("GET returns state when user may access workflow", async () => {
    vi.mocked(loadMatchArbiterRequestsForUser).mockResolvedValue({
      state: baseState,
      canSubmitScore: true,
    });
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ matchId: "match-1" }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.state.can_submit).toBe(true);
  });

  it("POST submits with legacy image_path", async () => {
    vi.mocked(createArbiterRequest).mockResolvedValue("req-1");
    vi.mocked(loadMatchArbiterRequestsForUser).mockResolvedValue({
      state: {
        ...baseState,
        can_submit: false,
        requests: [
          {
            id: "req-1",
            description: null,
            image_path: "arbiter/match-1/file.pdf",
            attachments: [
              {
                id: "a1",
                storage_path: "arbiter/match-1/file.pdf",
                sort_order: 0,
              },
            ],
            status: "open",
            created_at: "2025-01-01T00:00:00.000Z",
            resolved_at: null,
            can_cancel: false,
          },
        ],
      },
      canSubmitScore: true,
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
      ["arbiter/match-1/file.pdf"],
    );
    expect(sendArbiterRequestCreatedEmail).toHaveBeenCalledWith(
      { matchId: "match-1" },
      "en",
    );
    expect(revalidateStandingsForGroup).toHaveBeenCalledWith(
      expect.anything(),
      "group-1",
    );
  });

  it("POST submits with image_paths array", async () => {
    vi.mocked(createArbiterRequest).mockResolvedValue("req-2");
    vi.mocked(loadMatchArbiterRequestsForUser).mockResolvedValue({
      state: baseState,
      canSubmitScore: true,
    });

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          image_paths: [
            "arbiter/match-1/a.pdf",
            "arbiter/match-1/b.pdf",
          ],
        }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );

    expect(res.status).toBe(200);
    expect(createArbiterRequest).toHaveBeenCalledWith(
      expect.anything(),
      "match-1",
      ["arbiter/match-1/a.pdf", "arbiter/match-1/b.pdf"],
    );
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

  it("POST returns 400 when more than 5 paths", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          image_paths: ["a", "b", "c", "d", "e", "f"],
        }),
      }),
      { params: Promise.resolve({ matchId: "match-1" }) },
    );
    expect(res.status).toBe(400);
    expect(createArbiterRequest).not.toHaveBeenCalled();
  });
});
