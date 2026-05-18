import {
  COMPETITION_ADMIN_ROLES,
  requireAuth,
  requireRoles,
} from "@/lib/auth/route-auth";
import {
  assertCanAdminEditScore,
  assertCanSubmitScore,
  assertCanViewMatchOps,
  loadMatchContext,
} from "@/lib/auth/match-access";
import { submitMatchScore } from "@/lib/scoring/match-operations";
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
      match: {
        id: match.id,
        board_count: match.board_count,
        imps_home: match.imps_home,
        imps_away: match.imps_away,
        vp_home: match.vp_home,
        vp_away: match.vp_away,
        played_at: match.played_at,
      },
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

    return jsonOk({ match: result }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    assertCanAdminEditScore(roles);

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

    const result = await submitMatchScore(supabase, match, user.id, imps, {
      isAdminEdit: true,
      previous,
    });

    return jsonOk({ match: result });
  } catch (err) {
    return jsonFromError(err);
  }
}
