import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

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

vi.mock("@/lib/competition/honor-seating-overview", () => ({
  resolveActiveHonorGroup: vi.fn(),
  loadHonorRoundMeta: vi.fn(),
  loadHonorRoundSeating: vi.fn(),
  defaultHonorRound: vi.fn(),
}));

vi.mock("@/lib/bridgemate/honor-bws-export", () => ({
  exportHonorRoundBws: vi.fn(),
}));

import { requireRoles } from "@/lib/auth/route-auth";
import { exportHonorRoundBws } from "@/lib/bridgemate/honor-bws-export";
import {
  defaultHonorRound,
  loadHonorRoundMeta,
  loadHonorRoundSeating,
  resolveActiveHonorGroup,
} from "@/lib/competition/honor-seating-overview";

describe("GET /api/arbiter/honor/bridgemate/bws", () => {
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
    vi.mocked(loadHonorRoundSeating).mockResolvedValue({
      phase: "sequential",
      matches: [{ match_id: "m1" } as never],
      tables: [],
    });
  });

  it("returns octet-stream download when export succeeds", async () => {
    vi.mocked(exportHonorRoundBws).mockReturnValue({
      ok: true,
      plan: {
        filename: "honneur-ronde-1.bws",
        session: {
          id: 1,
          name: "Honneur ronde 1",
          guid: "{x}",
          status: 0,
          showInApp: false,
          pairsMoveAcrossField: false,
          ewReturnHome: false,
        },
        sections: [],
        tables: [],
        roundData: [],
        playerNumbers: [],
        settings: [],
      },
      buffer: Buffer.from("bws-bytes"),
    });

    const res = await GET(
      new Request("http://localhost/api/arbiter/honor/bridgemate/bws?round=1"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Content-Disposition")).toContain(
      'filename="honneur-ronde-1.bws"',
    );
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.toString()).toBe("bws-bytes");
  });

  it("returns 400 with errors when seating incomplete", async () => {
    vi.mocked(exportHonorRoundBws).mockReturnValue({
      ok: false,
      errors: ["Home vs Away: niet beide line-ups zijn vastgelegd."],
    });

    const res = await GET(
      new Request("http://localhost/api/arbiter/honor/bridgemate/bws?round=1"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/vastgelegd/);
    expect(body.errors).toHaveLength(1);
  });

  it("404 when Honor group missing", async () => {
    vi.mocked(resolveActiveHonorGroup).mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/arbiter/honor/bridgemate/bws"),
    );
    expect(res.status).toBe(404);
  });
});
