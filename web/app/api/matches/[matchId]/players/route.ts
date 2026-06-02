import { requireAuth } from "@/lib/auth/route-auth";
import {
  assertCanEditLineup,
  assertCanViewMatchOps,
  loadMatchContext,
} from "@/lib/auth/match-access";
import { requireActiveSeason } from "@/lib/competition/season";
import {
  getMatchLineup,
  replaceMatchLineup,
  validateLineupPayload,
  type LineupPlayerInput,
} from "@/lib/scoring/match-operations";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { matchStatus } from "@/lib/scoring/match-state";

type Params = { params: Promise<{ matchId: string }> };

function groupLineupByTeam(
  lineup: Awaited<ReturnType<typeof getMatchLineup>>,
  homeTeamId: string,
  awayTeamId: string,
) {
  return {
    home: lineup.filter((r) => r.team_id === homeTeamId),
    away: lineup.filter((r) => r.team_id === awayTeamId),
  };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    await assertCanViewMatchOps(supabase, matchId);
    const match = await loadMatchContext(supabase, matchId);
    const lineup = await getMatchLineup(supabase, matchId);

    return jsonOk({
      match_id: matchId,
      home_team_id: match.home_team_id,
      away_team_id: match.away_team_id,
      played_at: match.played_at,
      status: matchStatus(match.played_at),
      lineup: groupLineupByTeam(
        lineup,
        match.home_team_id,
        match.away_team_id,
      ),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    const match = await loadMatchContext(supabase, matchId);
    await assertCanEditLineup(supabase, match);

    const body = await request.json();
    const teamId = body.team_id as string | undefined;
    const players = body.players as LineupPlayerInput[] | undefined;

    if (!teamId || !Array.isArray(players)) {
      return jsonErrorCode(ErrorCodes.api.teamAndPlayersRequired, 400);
    }

    if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
      return jsonErrorCode(ErrorCodes.api.teamIdHomeOrAway, 400);
    }

    const clubId =
      teamId === match.home_team_id
        ? match.home_team.club_id
        : match.away_team.club_id;
    const season = await requireActiveSeason(supabase);
    const normalized = players.map((p) => ({
      player_id: p.player_id,
      is_substitute: Boolean(p.is_substitute),
    }));

    await validateLineupPayload(
      supabase,
      teamId,
      clubId,
      season.id,
      normalized,
    );

    const lineup = await replaceMatchLineup(
      supabase,
      matchId,
      teamId,
      normalized,
    );

    return jsonOk({
      match_id: matchId,
      lineup: groupLineupByTeam(
        lineup,
        match.home_team_id,
        match.away_team_id,
      ),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
