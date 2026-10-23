import { requireRoles } from "@/lib/auth/route-auth";
import {
  assertCanEditFinishedScoreForMatch,
  loadMatchContext,
} from "@/lib/auth/match-access";
import { FINISHED_SCORE_EDIT_ROLES } from "@/lib/auth/roles";
import { revalidateMatchDerivedViews } from "@/lib/competition/revalidate-standings";
import { jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import {
  applyForfait,
  clearForfait,
  isForfaitSide,
  type ForfaitSide,
} from "@/lib/scoring/forfait";
import { matchResponseFields } from "@/lib/scoring/match-state";

type Params = { params: Promise<{ matchId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { user, roles, supabase } = await requireRoles([
      ...FINISHED_SCORE_EDIT_ROLES,
    ]);
    await assertCanEditFinishedScoreForMatch(supabase, roles, matchId);
    const match = await loadMatchContext(supabase, matchId);

    if (match.forfait_side) {
      return jsonErrorCode(ErrorCodes.api.forfaitAlreadySet, 400);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const rawSide = body.side ?? body.forfait_side ?? body.forfaitSide;
    if (!isForfaitSide(rawSide)) {
      return jsonErrorCode(ErrorCodes.api.forfaitSideRequired, 400);
    }
    const side: ForfaitSide = rawSide;

    const { vpHome, vpAway } = await applyForfait(
      supabase,
      match,
      side,
      user.id,
    );

    await revalidateMatchDerivedViews(supabase, match);

    const updated = await loadMatchContext(supabase, matchId);
    return jsonOk(
      {
        match: matchResponseFields({
          id: updated.id,
          played_at: updated.played_at,
          vp_home: vpHome,
          vp_away: vpAway,
          imps_home: updated.imps_home,
          imps_away: updated.imps_away,
          forfait_side: updated.forfait_side,
        }),
      },
      { status: 201 },
    );
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { user, roles, supabase } = await requireRoles([
      ...FINISHED_SCORE_EDIT_ROLES,
    ]);
    await assertCanEditFinishedScoreForMatch(supabase, roles, matchId);
    const match = await loadMatchContext(supabase, matchId);

    if (!match.forfait_side) {
      return jsonErrorCode(ErrorCodes.api.forfaitNotSet, 400);
    }

    await clearForfait(supabase, match, user.id);
    await revalidateMatchDerivedViews(supabase, match);

    const updated = await loadMatchContext(supabase, matchId);
    return jsonOk({
      match: matchResponseFields({
        id: updated.id,
        played_at: updated.played_at,
        vp_home: updated.vp_home,
        vp_away: updated.vp_away,
        imps_home: updated.imps_home,
        imps_away: updated.imps_away,
        forfait_side: updated.forfait_side,
      }),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
