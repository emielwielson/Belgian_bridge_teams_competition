import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { activeSeasonTeamIds } from "@/lib/competition/admin-season-scope";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const groupId = new URL(request.url).searchParams.get("groupId");
    const teamFilter = await activeSeasonTeamIds(supabase, groupId);

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
    const { user, supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();

    const teamId = body.team_id as string | undefined;
    const warningDate = body.warning_date as string | undefined;
    const reason = body.reason as string | undefined;

    if (!teamId || !warningDate || !reason?.trim()) {
      return jsonError("team_id, warning_date, and reason are required", 400);
    }

    const seasonTeams = await activeSeasonTeamIds(supabase);
    if (!seasonTeams.has(teamId)) {
      return jsonError("Team is not in the active season", 400);
    }

    const { data, error } = await supabase
      .from("warnings")
      .insert({
        team_id: teamId,
        warning_date: warningDate,
        reason: reason.trim(),
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
