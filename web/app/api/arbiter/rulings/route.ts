import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
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
import {
  jsonError,
  jsonFromError,
  jsonOk,
  jsonErrorCode,
} from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { isHonorDivision } from "@/lib/scoring/board-count-rules";
import { createServiceClient } from "@/lib/supabase/server-client";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadMatchGroupId(
  supabase: SupabaseClient,
  matchId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("matches")
    .select("group_id")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  return data?.group_id ?? null;
}

async function assertHonorMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<string> {
  const groupId = await loadMatchGroupId(supabase, matchId);
  if (!groupId) {
    throw new Error("Match not found");
  }
  const scoring = await loadGroupScoringContext(supabase, groupId);
  if (!isHonorDivision(scoring)) {
    throw new Error("Honor Division rulings only");
  }
  return groupId;
}

export async function GET(request: Request) {
  try {
    const { roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    const matchId = new URL(request.url).searchParams.get("matchId");
    if (!matchId?.trim()) {
      return jsonErrorCode(ErrorCodes.api.matchIdRequired, 400);
    }

    await assertCanAddPenaltyForMatch(supabase, roles, matchId);
    await assertHonorMatch(supabase, matchId);

    const canChooseArbiter = canChooseRulingArbiter(roles);
    const service = createServiceClient();

    const [{ data, error }, honorArbiters] = await Promise.all([
      supabase
        .from("rulings")
        .select(
          `
          id,
          match_id,
          board,
          file_path,
          ruling_date,
          created_at,
          created_by,
          created_by_name,
          arbiter_request_id
        `,
        )
        .eq("match_id", matchId)
        .order("ruling_date", { ascending: false }),
      canChooseArbiter
        ? listHonorArbitersForAttribution(service)
        : Promise.resolve([]),
    ]);

    if (error) return jsonError(error.message, 500);

    const rulings = await Promise.all(
      (data ?? []).map(async (row) => {
        let signed_url: string | null = null;
        try {
          signed_url = await createOperationalSignedUrl(service, row.file_path);
        } catch {
          signed_url = null;
        }
        return { ...row, signed_url };
      }),
    );

    return jsonOk({
      rulings,
      canChooseArbiter,
      honorArbiters,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Honor Division rulings only") {
      return jsonErrorCode(ErrorCodes.api.honorRulingOnly, 403);
    }
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, roles, supabase } = await requireRoles([
      ...ARBITER_ACCESS_ROLES,
    ]);
    const body = await request.json();

    const matchId = body.match_id as string | undefined;
    const boardRaw = body.board;
    const board =
      boardRaw != null && boardRaw !== "" && Number.isFinite(Number(boardRaw))
        ? Number(boardRaw)
        : null;
    const filePath = body.file_path as string | undefined;
    const rulingDate = (body.ruling_date as string | undefined) ?? null;
    const arbiterUserIdRaw = body.arbiter_user_id;
    const arbiterUserId =
      typeof arbiterUserIdRaw === "string" && arbiterUserIdRaw.trim()
        ? arbiterUserIdRaw.trim()
        : null;

    if (!matchId || !filePath?.trim()) {
      return jsonErrorCode(ErrorCodes.api.matchIdAndFileRequired, 400);
    }
    if (board != null && (!Number.isInteger(board) || board < 1)) {
      return jsonErrorCode(ErrorCodes.api.boardPositiveInteger, 400);
    }

    await assertCanAddPenaltyForMatch(supabase, roles, matchId);
    const groupId = await assertHonorMatch(supabase, matchId);

    if (!(await isGroupInActiveSeason(supabase, groupId))) {
      return jsonErrorCode(ErrorCodes.api.matchNotActiveSeason, 400);
    }

    let createdBy = user.id;
    if (canChooseRulingArbiter(roles)) {
      if (!arbiterUserId) {
        return jsonErrorCode(ErrorCodes.api.arbiterUserIdRequired, 400);
      }
      const service = createServiceClient();
      await assertHonorArbiterUser(service, arbiterUserId);
      createdBy = arbiterUserId;
    }

    const { data, error } = await supabase
      .from("rulings")
      .insert({
        match_id: matchId,
        board: board ?? undefined,
        file_path: filePath.trim(),
        ruling_date: rulingDate ?? undefined,
        created_by: createdBy,
      })
      .select(
        "id, match_id, board, file_path, ruling_date, created_at, created_by, created_by_name",
      )
      .single();

    if (error) return jsonError(error.message, 400);

    await supabase.from("match_logs").insert({
      match_id: matchId,
      action: "ruling_created",
      user_id: user.id,
    });

    await revalidateStandingsForGroup(supabase, groupId);

    return jsonOk({ ruling: data }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Honor Division rulings only") {
      return jsonErrorCode(ErrorCodes.api.honorRulingOnly, 403);
    }
    return jsonFromError(err);
  }
}
