import { NextResponse } from "next/server";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { recalculateHonorButler } from "@/lib/butler/recalculate";
import {
  defaultHonorRound,
  loadHonorRoundMeta,
  resolveActiveHonorGroup,
} from "@/lib/competition/honor-seating-overview";
import { createServiceClient } from "@/lib/supabase/server-client";
import { jsonError, jsonFromError } from "@/lib/http/api-response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ round: string }> },
) {
  try {
    await requireRoles([...ARBITER_ACCESS_ROLES]);
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

    return NextResponse.json({
      ok: true,
      round,
      boardIds: result.boardIds,
      resultCount: result.resultCount,
      updatedCount: result.updatedCount,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
