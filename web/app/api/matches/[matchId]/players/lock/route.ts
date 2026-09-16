import { AuthError } from "@/lib/auth/auth-error";
import { requireAuth } from "@/lib/auth/route-auth";
import {
  assertCanEditLineup,
  loadMatchContext,
} from "@/lib/auth/match-access";
import {
  canLockHonorSide,
  isHonorSeatedLineupComplete,
  type HonorSide,
} from "@/lib/competition/honor-lineup";
import {
  loadHonorMatchLineupContext,
  resolveHonorViewerSide,
} from "@/lib/competition/honor-lineup-access";
import { revalidatePlayersForMatch } from "@/lib/competition/revalidate-standings";
import {
  getMatchLineup,
  setMatchLineupLockedAt,
} from "@/lib/scoring/match-operations";
import { jsonErrorCode, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

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
    await assertCanEditLineup(supabase, match);

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
    const isManager = viewerSide === "manager";
    if (!isManager && viewerSide !== side) {
      throw new AuthError("Forbidden: cannot edit lineup for this match", 403);
    }

    const lineup = await getMatchLineup(supabase, matchId);
    const sideRows = lineup.filter((r) => r.team_id === teamId);
    const seatsComplete = isHonorSeatedLineupComplete(sideRows, side);

    if (
      !canLockHonorSide({
        side,
        phase: honorCtx.phase,
        homeLocked: honorCtx.homeLocked,
        awayLocked: honorCtx.awayLocked,
        isManager,
        played: match.played_at != null,
        seatsComplete,
      })
    ) {
      if (!seatsComplete) {
        return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
      }
      throw new AuthError("Forbidden: cannot edit lineup for this match", 403);
    }

    const lockedAt = new Date().toISOString();
    await setMatchLineupLockedAt(supabase, matchId, side, lockedAt);
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
