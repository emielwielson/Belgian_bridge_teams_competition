import { NextResponse } from "next/server";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import {
  assessHonorRoundCompleteness,
  publishHonorRound,
} from "@/lib/butler/completeness";
import {
  defaultHonorRound,
  loadHonorRoundMeta,
  loadHonorRoundSeating,
  resolveActiveHonorGroup,
} from "@/lib/competition/honor-seating-overview";
import { createServiceClient } from "@/lib/supabase/server-client";
import { jsonError, jsonFromError } from "@/lib/http/api-response";

export async function GET(
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

    const seating = await loadHonorRoundSeating(service, group, round);
    const completeness = await assessHonorRoundCompleteness(service, {
      groupId: group.id,
      tournamentRound: round,
      matches: seating.matches,
    });

    const { data: pub } = await service
      .from("honor_round_publication")
      .select("status, published_at")
      .eq("group_id", group.id)
      .eq("tournament_round", round)
      .maybeSingle();

    const { count: boardCount } = await service
      .from("honor_boards")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id)
      .eq("tournament_round", round);

    return NextResponse.json({
      round,
      publication: pub ?? { status: "draft", published_at: null },
      board_count: boardCount ?? 0,
      completeness,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ round: string }> },
) {
  try {
    const { user } = await requireRoles([...ARBITER_ACCESS_ROLES]);
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

    const seating = await loadHonorRoundSeating(service, group, round);
    const result = await publishHonorRound(service, {
      groupId: group.id,
      tournamentRound: round,
      matches: seating.matches,
      publishedBy: user.id,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          completeness: result.completeness,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, round });
  } catch (err) {
    return jsonFromError(err);
  }
}
