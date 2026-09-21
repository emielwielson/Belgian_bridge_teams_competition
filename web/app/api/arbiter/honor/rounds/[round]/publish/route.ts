import { NextResponse } from "next/server";
import { assertArbiterHonorApiAccess } from "@/lib/auth/arbiter-scope";
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
import { revalidateButlerPublicPages } from "@/lib/butler/revalidate-butler";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { createServiceClient } from "@/lib/supabase/server-client";
import { jsonError, jsonFromError } from "@/lib/http/api-response";

export async function GET(
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
          completeness: "completeness" in result ? result.completeness : undefined,
        },
        { status: 400 },
      );
    }

    await revalidateStandingsForGroup(service, group.id);
    revalidateButlerPublicPages();

    return NextResponse.json({
      ok: true,
      round,
      scores: result.scores,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
