import {
  assertCanEditLineup,
  assertCanViewMatchOps,
  loadMatchContext,
} from "@/lib/auth/match-access";
import { loadClubSubCandidates } from "@/lib/competition/player-matches";
import { requireActiveSeason } from "@/lib/competition/season";
import { requireAuth } from "@/lib/auth/route-auth";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ matchId: string }> };

function clubIdForTeam(
  match: Awaited<ReturnType<typeof loadMatchContext>>,
  teamId: string,
): string | null {
  if (teamId === match.home_team_id) return match.home_team.club_id;
  if (teamId === match.away_team_id) return match.away_team.club_id;
  return null;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const teamId = new URL(request.url).searchParams.get("team_id");
    if (!teamId) return jsonError("team_id query parameter is required", 400);

    const { supabase } = await requireAuth();
    await assertCanViewMatchOps(supabase, matchId);
    const match = await loadMatchContext(supabase, matchId);
    await assertCanEditLineup(supabase, match);

    const clubId = clubIdForTeam(match, teamId);
    if (!clubId) {
      return jsonError("team_id must be home or away for this match", 400);
    }

    const season = await requireActiveSeason(supabase);
    const players = await loadClubSubCandidates(
      supabase,
      clubId,
      teamId,
      season.id,
    );

    return jsonOk({ players });
  } catch (err) {
    return jsonFromError(err);
  }
}
