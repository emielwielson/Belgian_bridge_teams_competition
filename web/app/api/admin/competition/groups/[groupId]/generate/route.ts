import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { loadGroupScoringContext } from "@/lib/competition/match-scoring-context";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { requireGroupInSetup } from "@/lib/competition/scope-setup";
import { jsonFromError, jsonOk } from "@/lib/http/api-response";
import { scheduledBoardCount } from "@/lib/scoring/board-count-rules";
import { generateGroupScheduleInDb } from "@/lib/scheduling/generate-group-schedule-db";

type Params = { params: Promise<{ groupId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { groupId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    await requireGroupInSetup(supabase, groupId);

    const scoringContext = await loadGroupScoringContext(supabase, groupId);
    const boardCount = scheduledBoardCount(scoringContext);

    const result = await generateGroupScheduleInDb(
      supabase,
      groupId,
      boardCount,
    );

    await revalidateStandingsForGroup(supabase, groupId);

    return jsonOk(result);
  } catch (err) {
    return jsonFromError(err);
  }
}
