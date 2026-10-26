import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/auth-error";
import { GET, POST } from "./route";

vi.mock("@/lib/auth/route-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/route-auth")>();
  return {
    ...actual,
    requireRoles: vi.fn(),
  };
});

vi.mock("@/lib/auth/match-access", () => ({
  assertCanAddPenaltyForMatch: vi.fn(),
}));

vi.mock("@/lib/competition/admin-season-scope", () => ({
  isGroupInActiveSeason: vi.fn(),
}));

vi.mock("@/lib/competition/match-scoring-context", () => ({
  loadGroupScoringContext: vi.fn(),
}));

vi.mock("@/lib/competition/revalidate-standings", () => ({
  revalidateStandingsForGroup: vi.fn(),
}));

vi.mock("@/lib/files/operational-file-storage", () => ({
  createOperationalSignedUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({
  createServiceClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/scoring/board-count-rules", () => ({
  isHonorDivision: vi.fn(),
}));

vi.mock("@/lib/competition/honor-rulings", () => ({
  canChooseRulingArbiter: vi.fn(),
  listHonorArbitersForAttribution: vi.fn(),
  assertHonorArbiterUser: vi.fn(),
}));

import { requireRoles } from "@/lib/auth/route-auth";
import { assertCanAddPenaltyForMatch } from "@/lib/auth/match-access";
import { isGroupInActiveSeason } from "@/lib/competition/admin-season-scope";
import {
  assertHonorArbiterUser,
  canChooseRulingArbiter,
  listHonorArbitersForAttribution,
} from "@/lib/competition/honor-rulings";
import { loadGroupScoringContext } from "@/lib/competition/match-scoring-context";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { createOperationalSignedUrl } from "@/lib/files/operational-file-storage";
import { isHonorDivision } from "@/lib/scoring/board-count-rules";
import { ErrorCodes } from "@/lib/http/error-codes";

function mockSupabase(handlers: {
  matchGroupId?: string | null;
  insertRuling?: { data: unknown; error: unknown };
  selectRulings?: { data: unknown; error: unknown };
  matchLogs?: { error: unknown };
  onInsert?: (row: Record<string, unknown>) => void;
}) {
  const from = vi.fn((table: string) => {
    if (table === "matches") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data:
                handlers.matchGroupId != null
                  ? { group_id: handlers.matchGroupId }
                  : null,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "rulings") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue(
              handlers.selectRulings ?? { data: [], error: null },
            ),
          }),
        }),
        insert: vi.fn((row: Record<string, unknown>) => {
          handlers.onInsert?.(row);
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                handlers.insertRuling ?? {
                  data: {
                    id: "ruling-1",
                    match_id: "match-1",
                    board: null,
                    file_path: "rulings/m1/a.pdf",
                    ruling_date: "2026-03-01",
                    created_at: "2026-03-01T12:00:00Z",
                    created_by: row.created_by,
                    created_by_name: "Arbiter Name",
                  },
                  error: null,
                },
              ),
            }),
          };
        }),
      };
    }
    if (table === "match_logs") {
      return {
        insert: vi.fn().mockResolvedValue(handlers.matchLogs ?? { error: null }),
      };
    }
    return {};
  });
  return { from } as never;
}

describe("/api/arbiter/rulings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertCanAddPenaltyForMatch).mockResolvedValue(undefined);
    vi.mocked(loadGroupScoringContext).mockResolvedValue({
      leagueScope: "national",
      divisionLevelCode: "honor",
    } as never);
    vi.mocked(isHonorDivision).mockReturnValue(true);
    vi.mocked(isGroupInActiveSeason).mockResolvedValue(true);
    vi.mocked(createOperationalSignedUrl).mockResolvedValue(
      "https://signed/ruling.pdf",
    );
    vi.mocked(revalidateStandingsForGroup).mockResolvedValue(undefined);
    vi.mocked(canChooseRulingArbiter).mockReturnValue(false);
    vi.mocked(listHonorArbitersForAttribution).mockResolvedValue([]);
    vi.mocked(assertHonorArbiterUser).mockResolvedValue(undefined);
  });

  describe("POST", () => {
    it("creates a ruling for honor arbiter as themselves", async () => {
      let inserted: Record<string, unknown> | null = null;
      const supabase = mockSupabase({
        matchGroupId: "group-honor",
        onInsert: (row) => {
          inserted = row;
        },
      });
      vi.mocked(requireRoles).mockResolvedValue({
        user: { id: "arbiter-1" },
        roles: ["arbiter"],
        supabase,
      } as never);

      const res = await POST(
        new Request("http://x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_id: "match-1",
            file_path: "rulings/m1/a.pdf",
            ruling_date: "2026-03-01",
          }),
        }),
      );

      expect(res.status).toBe(201);
      expect(inserted?.created_by).toBe("arbiter-1");
      expect(assertHonorArbiterUser).not.toHaveBeenCalled();
      expect(revalidateStandingsForGroup).toHaveBeenCalledWith(
        supabase,
        "group-honor",
      );
      const body = await res.json();
      expect(body.ruling.id).toBe("ruling-1");
    });

    it("creates a ruling for competition manager attributed to a honor arbiter", async () => {
      let inserted: Record<string, unknown> | null = null;
      const supabase = mockSupabase({
        matchGroupId: "group-honor",
        onInsert: (row) => {
          inserted = row;
        },
      });
      vi.mocked(canChooseRulingArbiter).mockReturnValue(true);
      vi.mocked(requireRoles).mockResolvedValue({
        user: { id: "mgr-1" },
        roles: ["competition_manager"],
        supabase,
      } as never);

      const res = await POST(
        new Request("http://x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_id: "match-1",
            file_path: "rulings/m1/b.pdf",
            arbiter_user_id: "arbiter-2",
          }),
        }),
      );

      expect(res.status).toBe(201);
      expect(assertHonorArbiterUser).toHaveBeenCalledWith({}, "arbiter-2");
      expect(inserted?.created_by).toBe("arbiter-2");
    });

    it("requires arbiter_user_id for competition managers", async () => {
      vi.mocked(canChooseRulingArbiter).mockReturnValue(true);
      vi.mocked(requireRoles).mockResolvedValue({
        user: { id: "mgr-1" },
        roles: ["competition_manager"],
        supabase: mockSupabase({ matchGroupId: "group-honor" }),
      } as never);

      const res = await POST(
        new Request("http://x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_id: "match-1",
            file_path: "rulings/m1/b.pdf",
          }),
        }),
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: ErrorCodes.api.arbiterUserIdRequired,
      });
    });

    it("rejects missing file_path", async () => {
      vi.mocked(requireRoles).mockResolvedValue({
        user: { id: "arbiter-1" },
        roles: ["arbiter"],
        supabase: mockSupabase({ matchGroupId: "group-honor" }),
      } as never);

      const res = await POST(
        new Request("http://x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match_id: "match-1" }),
        }),
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: ErrorCodes.api.matchIdAndFileRequired,
      });
    });

    it("forbids when caller cannot discipline match", async () => {
      vi.mocked(requireRoles).mockResolvedValue({
        user: { id: "player-1" },
        roles: ["player"],
        supabase: mockSupabase({ matchGroupId: "group-honor" }),
      } as never);
      vi.mocked(assertCanAddPenaltyForMatch).mockRejectedValue(
        new AuthError(
          "Forbidden: only arbiters or competition managers can manage discipline",
          403,
        ),
      );

      const res = await POST(
        new Request("http://x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_id: "match-1",
            file_path: "rulings/m1/a.pdf",
          }),
        }),
      );

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toEqual({
        error: ErrorCodes.auth.onlyArbiterOrManagerDiscipline,
      });
    });

    it("forbids non-honor matches", async () => {
      const supabase = mockSupabase({ matchGroupId: "group-first" });
      vi.mocked(requireRoles).mockResolvedValue({
        user: { id: "arbiter-1" },
        roles: ["arbiter"],
        supabase,
      } as never);
      vi.mocked(isHonorDivision).mockReturnValue(false);

      const res = await POST(
        new Request("http://x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_id: "match-1",
            file_path: "rulings/m1/a.pdf",
          }),
        }),
      );

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toEqual({
        error: ErrorCodes.api.honorRulingOnly,
      });
      expect(revalidateStandingsForGroup).not.toHaveBeenCalled();
    });

    it("rejects when the honor group is not in the active season", async () => {
      const supabase = mockSupabase({ matchGroupId: "group-honor" });
      vi.mocked(requireRoles).mockResolvedValue({
        user: { id: "arbiter-1" },
        roles: ["arbiter"],
        supabase,
      } as never);
      vi.mocked(isGroupInActiveSeason).mockResolvedValue(false);

      const res = await POST(
        new Request("http://x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_id: "match-1",
            file_path: "rulings/m1/a.pdf",
          }),
        }),
      );

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: ErrorCodes.api.matchNotActiveSeason,
      });
      expect(isGroupInActiveSeason).toHaveBeenCalledWith(
        supabase,
        "group-honor",
      );
      expect(revalidateStandingsForGroup).not.toHaveBeenCalled();
    });
  });

  describe("GET", () => {
    it("lists rulings with signed urls", async () => {
      const supabase = mockSupabase({
        matchGroupId: "group-honor",
        selectRulings: {
          data: [
            {
              id: "r1",
              match_id: "match-1",
              board: 3,
              file_path: "rulings/m1/a.pdf",
              ruling_date: "2026-03-01",
              created_at: "2026-03-01T12:00:00Z",
              arbiter_request_id: null,
            },
          ],
          error: null,
        },
      });
      vi.mocked(requireRoles).mockResolvedValue({
        user: { id: "arbiter-1" },
        roles: ["arbiter"],
        supabase,
      } as never);

      const res = await GET(
        new Request("http://x/api/arbiter/rulings?matchId=match-1"),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.rulings).toHaveLength(1);
      expect(body.rulings[0].signed_url).toBe("https://signed/ruling.pdf");
    });

    it("requires matchId", async () => {
      vi.mocked(requireRoles).mockResolvedValue({
        user: { id: "arbiter-1" },
        roles: ["arbiter"],
        supabase: mockSupabase({ matchGroupId: "group-honor" }),
      } as never);

      const res = await GET(new Request("http://x/api/arbiter/rulings"));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: ErrorCodes.api.matchIdRequired,
      });
    });
  });
});
