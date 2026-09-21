import { NextResponse } from "next/server";
import { assertArbiterHonorApiAccess } from "@/lib/auth/arbiter-scope";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { recalculateHonorButler } from "@/lib/butler/recalculate";
import { revalidateButlerPublicPages } from "@/lib/butler/revalidate-butler";
import {
  defaultHonorRound,
  loadHonorRoundMeta,
  resolveActiveHonorGroup,
} from "@/lib/competition/honor-seating-overview";
import { maybeRefreshPublishedMatchScores } from "@/lib/results/refresh-published-scores";
import { createServiceClient } from "@/lib/supabase/server-client";
import { jsonError, jsonFromError } from "@/lib/http/api-response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ round: string }> },
) {
  try {
    const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    await assertArbiterHonorApiAccess(supabase, user.id, roles);
    const service = createServiceClient();
    const group = await resolveActiveHonorGroup(service);
    if (!group) {
      return jsonError("Honor division group not found for the active season", 404);
    }

    const { round: roundSeg } = await context.params;
    const meta = await loadHonorRoundMeta(service, group.id);
    const requested = Number(roundSeg);
    const round =
      Number.isInteger(requested) &&
      requested >= 1 &&
      requested <= group.round_count
        ? requested
        : defaultHonorRound(meta);

    const result = await recalculateHonorButler(service, {
      groupId: group.id,
      tournamentRound: round,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const matchScores = await maybeRefreshPublishedMatchScores(service, {
      groupId: group.id,
      tournamentRound: round,
      userId: user.id,
    });

    revalidateButlerPublicPages();

    return NextResponse.json({
      ok: true,
      round,
      boardIds: result.boardIds,
      resultCount: result.resultCount,
      updatedCount: result.updatedCount,
      matchScores,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
