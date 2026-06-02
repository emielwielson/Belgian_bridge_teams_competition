import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import {
  activeSeasonTeamIds,
  parsePenaltyInput,
  teamIdsForGroupFilter,
} from "@/lib/competition/penalties";
import { revalidateStandingsForTeam } from "@/lib/competition/revalidate-standings";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const groupId = new URL(request.url).searchParams.get("groupId");

    const seasonTeamIds = await activeSeasonTeamIds(supabase);
    const teamFilter = await teamIdsForGroupFilter(
      supabase,
      groupId,
      seasonTeamIds,
    );

    if (teamFilter.size === 0) return jsonOk({ penalties: [] });

    const { data, error } = await supabase
      .from("penalties")
      .select(
        `
        id,
        team_id,
        penalty_date,
        reason,
        vp_deduction,
        file_path,
        created_at,
        updated_at,
        team:teams (id, name, group_id)
      `,
      )
      .in("team_id", [...teamFilter])
      .order("penalty_date", { ascending: false });

    if (error) return jsonError(error.message, 500);

    return jsonOk({ penalties: data ?? [] });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();
    const parsed = parsePenaltyInput(body);
    if ("error" in parsed) return jsonErrorCode(parsed.error, 400);

    const { data, error } = await supabase
      .from("penalties")
      .insert({
        team_id: parsed.teamId,
        penalty_date: parsed.penaltyDate,
        reason: parsed.reason,
        vp_deduction: parsed.vpDeduction,
        file_path: parsed.filePath,
        created_by: user.id,
      })
      .select(
        "id, team_id, penalty_date, reason, vp_deduction, file_path, created_at",
      )
      .single();

    if (error) return jsonError(error.message, 400);

    await revalidateStandingsForTeam(supabase, parsed.teamId);

    return jsonOk({ penalty: data }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}
