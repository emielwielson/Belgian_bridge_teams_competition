import { requireAuth } from "@/lib/auth/route-auth";
import {
  assertCanViewMatchOps,
  loadMatchContext,
} from "@/lib/auth/match-access";
import { jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ matchId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    await assertCanViewMatchOps(supabase, matchId);
    const match = await loadMatchContext(supabase, matchId);

    return jsonOk({
      match: {
        id: match.id,
        group_id: match.group_id,
        round: match.round,
        datetime: match.datetime,
        board_count: match.board_count,
        played_at: match.played_at,
        home_team: match.home_team,
        away_team: match.away_team,
        imps_home: match.imps_home,
        imps_away: match.imps_away,
        vp_home: match.vp_home,
        vp_away: match.vp_away,
      },
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
