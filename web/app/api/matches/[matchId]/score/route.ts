import {
  requireAuth,
  requireRoles,
} from "@/lib/auth/route-auth";
import {
  assertCanEditFinishedScore,
  assertCanSubmitScore,
  assertCanViewMatchOps,
  loadMatchContext,
} from "@/lib/auth/match-access";
import { FINISHED_SCORE_EDIT_ROLES, ROLES } from "@/lib/auth/roles";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { submitMatchScore } from "@/lib/scoring/match-operations";
import { matchResponseFields } from "@/lib/scoring/match-state";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ matchId: string }> };

function parseImps(body: Record<string, unknown>): { impsHome: number; impsAway: number } | null {
  const impsHome = Number(body.imps_home ?? body.impsHome);
  const impsAway = Number(body.imps_away ?? body.impsAway);
  if (!Number.isFinite(impsHome) || !Number.isFinite(impsAway)) {
    return null;
  }
  return { impsHome, impsAway };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    await assertCanViewMatchOps(supabase, matchId);
    const match = await loadMatchContext(supabase, matchId);

    return jsonOk({
      match: matchResponseFields({
        id: match.id,
        board_count: match.board_count,
        imps_home: match.imps_home,
        imps_away: match.imps_away,
        vp_home: match.vp_home,
        vp_away: match.vp_away,
        played_at: match.played_at,
      }),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { user, supabase } = await requireAuth();
    const match = await loadMatchContext(supabase, matchId);
    await assertCanSubmitScore(supabase, match);

    const body = await request.json();
    const imps = parseImps(body);
    if (!imps) {
      return jsonError("imps_home and imps_away must be numbers", 400);
    }

    const result = await submitMatchScore(supabase, match, user.id, imps, {
      isAdminEdit: false,
    });

    await revalidateStandingsForGroup(supabase, match.group_id);

    return jsonOk({ match: matchResponseFields(result) }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { user, roles, supabase } = await requireRoles([
      ...FINISHED_SCORE_EDIT_ROLES,
    ]);
    assertCanEditFinishedScore(roles);

    const match = await loadMatchContext(supabase, matchId);
    if (!match.played_at) {
      return jsonError("Match has no official score yet; use POST to submit", 400);
    }

    const body = await request.json();
    const imps = parseImps(body);
    if (!imps) {
      return jsonError("imps_home and imps_away must be numbers", 400);
    }

    const previous =
      match.imps_home != null &&
      match.imps_away != null &&
      match.vp_home != null &&
      match.vp_away != null
        ? {
            impsHome: Number(match.imps_home),
            impsAway: Number(match.imps_away),
            vpHome: Number(match.vp_home),
            vpAway: Number(match.vp_away),
          }
        : undefined;

    const isArbiterEdit =
      roles.includes(ROLES.ARBITER) &&
      !roles.includes(ROLES.COMPETITION_MANAGER) &&
      !roles.includes(ROLES.SYSTEM_ADMIN);

    const result = await submitMatchScore(supabase, match, user.id, imps, {
      isAdminEdit: true,
      isArbiterEdit,
      previous,
    });

    await revalidateStandingsForGroup(supabase, match.group_id);

    return jsonOk({ match: matchResponseFields(result) });
  } catch (err) {
    return jsonFromError(err);
  }
}
