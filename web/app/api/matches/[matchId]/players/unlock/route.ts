import { AuthError } from "@/lib/auth/auth-error";
import { getArbiterAccess, hasArbiterHonorAccess } from "@/lib/auth/arbiter-scope";
import { requireAuth } from "@/lib/auth/route-auth";
import { loadMatchContext } from "@/lib/auth/match-access";
import type { HonorSide } from "@/lib/competition/honor-lineup";
import {
  canUnlockHonorLineup,
  loadHonorMatchLineupContext,
  resolveHonorViewerSide,
} from "@/lib/competition/honor-lineup-access";
import { revalidatePlayersForMatch } from "@/lib/competition/revalidate-standings";
import { setMatchLineupLockedAt } from "@/lib/scoring/match-operations";
import { jsonErrorCode, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createServiceClient } from "@/lib/supabase/server-client";

type Params = { params: Promise<{ matchId: string }> };

function sideForTeam(
  match: { home_team_id: string; away_team_id: string },
  teamId: string,
): HonorSide | null {
  if (teamId === match.home_team_id) return "home";
  if (teamId === match.away_team_id) return "away";
  return null;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase, user, roles } = await requireAuth();
    const match = await loadMatchContext(supabase, matchId);

    if (match.played_at) {
      throw new AuthError("Cannot unlock lineup after match is played", 403);
    }

    const body = await request.json();
    const teamId = body.team_id as string | undefined;
    if (!teamId) {
      return jsonErrorCode(ErrorCodes.api.teamIdHomeOrAway, 400);
    }

    const side = sideForTeam(match, teamId);
    if (!side) {
      return jsonErrorCode(ErrorCodes.api.teamIdHomeOrAway, 400);
    }

    const honorCtx = await loadHonorMatchLineupContext(supabase, match);
    if (!honorCtx.isHonor) {
      return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
    }

    const viewerSide = await resolveHonorViewerSide(
      supabase,
      user.id,
      roles,
      match,
    );
    const arbiterAccess = await getArbiterAccess(supabase, user.id, roles);
    if (
      !canUnlockHonorLineup({
        roles,
        viewerSide,
        hasHonorAccess: hasArbiterHonorAccess(arbiterAccess),
      })
    ) {
      throw new AuthError("Forbidden: cannot unlock lineup for this match", 403);
    }

    // Arbiter role has no matches write RLS; service client after auth check.
    const writer = createServiceClient();
    await setMatchLineupLockedAt(writer, matchId, side, null);
    await revalidatePlayersForMatch(supabase, matchId);

    const updated = await loadMatchContext(supabase, matchId);
    return jsonOk({
      match_id: matchId,
      team_id: teamId,
      side,
      home_lineup_locked_at: updated.home_lineup_locked_at,
      away_lineup_locked_at: updated.away_lineup_locked_at,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
