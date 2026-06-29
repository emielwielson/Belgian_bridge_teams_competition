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

vi.mock("@/lib/competition/arbiter-request", () => ({
  buildResolveActionsPayload: vi.fn(),
  resolveArbiterRequest: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateMatchDerivedViews: vi.fn(),
  revalidateStandingsForGroup: vi.fn(),
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
import {
  buildResolveActionsPayload,
  resolveArbiterRequest,
} from "@/lib/competition/arbiter-request";
import {
  revalidateMatchDerivedViews,
  revalidateStandingsForGroup,
} from "@/lib/competition/revalidate-standings";
import { createOperationalSignedUrl } from "@/lib/files/operational-file-storage";
import { sendArbiterRequestResolvedEmail } from "@/lib/notifications/arbiter-request-email";

const mockFrom = vi.fn();

describe("/api/arbiter/requests/[requestId]/resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === "arbiter_requests") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "req-1",
                  match_id: "match-1",
                  match: {
                    group_id: "group-1",
                    home_team_id: "home-1",
                    away_team_id: "away-1",
                  },
                },
                error: null,
              }),
            })),
          })),
        };
      }
      if (table === "rulings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { file_path: "rulings/m1/r.pdf" },
                error: null,
              }),
            })),
          })),
        };
      }
      return {};
    });

    vi.mocked(requireRoles).mockResolvedValue({
      user: { id: "arbiter-1" },
      roles: ["arbiter"],
      supabase: { from: mockFrom } as never,
    });
    vi.mocked(buildResolveActionsPayload).mockResolvedValue({});
    vi.mocked(resolveArbiterRequest).mockResolvedValue({
      rulingId: "ruling-1",
      score: null,
      penaltyIds: [],
      warningIds: [],
    });
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

  it("resolves request with ruling only and sends notification", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: "rulings/m1/r.pdf" }),
      }),
      { params: Promise.resolve({ requestId: "req-1" }) },
    );

    expect(res.status).toBe(200);
    expect(buildResolveActionsPayload).toHaveBeenCalledWith(
      expect.anything(),
      "group-1",
      { file_path: "rulings/m1/r.pdf" },
    );
    expect(resolveArbiterRequest).toHaveBeenCalledWith(expect.anything(), "req-1", {
      filePath: "rulings/m1/r.pdf",
      actions: {},
    });
    expect(sendArbiterRequestResolvedEmail).toHaveBeenCalledWith(
      {
        requestId: "req-1",
        rulingSignedUrl: "https://signed/r.pdf",
      },
      "en",
    );
  });

  it("passes score, penalty, and warning actions to resolve", async () => {
    vi.mocked(buildResolveActionsPayload).mockResolvedValue({
      score_change: {
        imps_home: 42,
        imps_away: 38,
        mis_seating: false,
        selected_board_count: null,
        vp_board_count: 32,
      },
      penalties: [
        {
          team_id: "team-home",
          penalty_date: "2026-06-12",
          reason: "Late lineup",
          vp_deduction: 1,
        },
      ],
      warnings: [
        {
          team_id: "team-away",
          warning_date: "2026-06-12",
          reason: "Slow play",
        },
      ],
    });
    vi.mocked(resolveArbiterRequest).mockResolvedValue({
      rulingId: "ruling-1",
      score: {
        imps_home: 42,
        imps_away: 38,
        vp_home: 12,
        vp_away: 8,
        vp_board_count: 32,
        mis_seating: false,
        selected_board_count: null,
      },
      penaltyIds: ["pen-1"],
      warningIds: ["warn-1"],
    });

    const body = {
      file_path: "rulings/m1/r.pdf",
      score_change: { imps_home: 42, imps_away: 38 },
      penalties: [{ team_id: "team-home", vp_deduction: 1, reason: "Late lineup", penalty_date: "2026-06-12" }],
      warnings: [{ team_id: "team-away", reason: "Slow play", warning_date: "2026-06-12" }],
    };

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ requestId: "req-1" }) },
    );

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(resolveArbiterRequest).toHaveBeenCalledWith(
      expect.anything(),
      "req-1",
      expect.objectContaining({
        filePath: "rulings/m1/r.pdf",
        actions: expect.objectContaining({
          score_change: expect.any(Object),
          penalties: expect.any(Array),
          warnings: expect.any(Array),
        }),
      }),
    );
    expect(revalidateMatchDerivedViews).toHaveBeenCalledWith(expect.anything(), {
      id: "match-1",
      group_id: "group-1",
      home_team_id: "home-1",
      away_team_id: "away-1",
    });
    expect(json.score).toEqual(expect.objectContaining({ imps_home: 42 }));
    expect(json.penaltyIds).toEqual(["pen-1"]);
    expect(json.warningIds).toEqual(["warn-1"]);
  });
});
