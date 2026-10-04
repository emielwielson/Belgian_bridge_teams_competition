import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { assertCanDisciplineTeam } from "@/lib/auth/match-access";
import {
  activeSeasonTeamIds,
  teamIdsForGroupFilter,
} from "@/lib/competition/penalties";
import { revalidateStandingsForTeam } from "@/lib/competition/revalidate-standings";
import { parseWarningInput } from "@/lib/competition/warnings";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    const params = new URL(request.url).searchParams;
    const groupId = params.get("groupId");
    const teamId = params.get("teamId");
    const seasonTeamIds = await activeSeasonTeamIds(supabase);

    let teamFilter: Set<string>;
    if (teamId) {
      if (!seasonTeamIds.has(teamId)) {
        return jsonOk({ warnings: [] });
      }
      teamFilter = new Set([teamId]);
    } else {
      teamFilter = await teamIdsForGroupFilter(
        supabase,
        groupId,
        seasonTeamIds,
      );
    }

    if (teamFilter.size === 0) return jsonOk({ warnings: [] });

    const { data, error } = await supabase
      .from("warnings")
      .select(
        `
        id,
        team_id,
        warning_date,
        reason,
        created_by,
        created_by_name,
        created_at,
        updated_at,
        updated_by_name,
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
    const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    const body = await request.json();
    const parsed = parseWarningInput(body);
    if ("error" in parsed) return jsonErrorCode(parsed.error, 400);

    const seasonTeams = await activeSeasonTeamIds(supabase);
    if (!seasonTeams.has(parsed.teamId)) {
      return jsonErrorCode(ErrorCodes.api.teamNotActiveSeason, 400);
    }

    await assertCanDisciplineTeam(supabase, roles, parsed.teamId);

    const { data, error } = await supabase
      .from("warnings")
      .insert({
        team_id: parsed.teamId,
        warning_date: parsed.warningDate,
        reason: parsed.reason,
        created_by: user.id,
      })
      .select(
        "id, team_id, warning_date, reason, created_by, created_by_name, created_at",
      )
      .single();

    if (error) return jsonError(error.message, 400);

    await revalidateStandingsForTeam(supabase, parsed.teamId);

    return jsonOk({ warning: data }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}
