import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import {
  activeSeasonTeamIds,
  teamIdsForGroupFilter,
} from "@/lib/competition/penalties";
import { parseWarningInput } from "@/lib/competition/warnings";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    const groupId = new URL(request.url).searchParams.get("groupId");
    const seasonTeamIds = await activeSeasonTeamIds(supabase);
    const teamFilter = await teamIdsForGroupFilter(
      supabase,
      groupId,
      seasonTeamIds,
    );

    if (teamFilter.size === 0) return jsonOk({ warnings: [] });

    const { data, error } = await supabase
      .from("warnings")
      .select(
        `
        id,
        team_id,
        warning_date,
        reason,
        created_at,
        updated_at,
        team:teams (id, name, group_id)
      `,
      )
      .in("team_id", [...teamFilter])
      .order("warning_date", { ascending: false });

    if (error) return jsonError(error.message, 500);

    return jsonOk({ warnings: data ?? [] });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    const body = await request.json();
    const parsed = parseWarningInput(body);
    if ("error" in parsed) return jsonErrorCode(parsed.error, 400);

    const seasonTeams = await activeSeasonTeamIds(supabase);
    if (!seasonTeams.has(parsed.teamId)) {
      return jsonErrorCode(ErrorCodes.api.teamNotActiveSeason, 400);
    }

    const { data, error } = await supabase
      .from("warnings")
      .insert({
        team_id: parsed.teamId,
        warning_date: parsed.warningDate,
        reason: parsed.reason,
        created_by: user.id,
      })
      .select("id, team_id, warning_date, reason, created_at")
      .single();

    if (error) return jsonError(error.message, 400);

    return jsonOk({ warning: data }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}
