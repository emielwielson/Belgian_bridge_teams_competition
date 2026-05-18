import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { revalidateStandingsForTeam } from "@/lib/competition/revalidate-standings";
import { requireActiveSeason } from "@/lib/competition/season";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

async function activeSeasonTeamIds(
  supabase: Awaited<ReturnType<typeof requireRoles>>["supabase"],
): Promise<Set<string>> {
  const season = await requireActiveSeason(supabase);
  const { data: leagues, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", season.id);
  if (leagueError) throw leagueError;

  const leagueIds = leagues?.map((l) => l.id) ?? [];
  if (leagueIds.length === 0) return new Set();

  const { data: divisions, error: divError } = await supabase
    .from("divisions")
    .select("id")
    .in("league_id", leagueIds);
  if (divError) throw divError;

  const divisionIds = divisions?.map((d) => d.id) ?? [];
  if (divisionIds.length === 0) return new Set();

  const { data: groups, error: groupError } = await supabase
    .from("groups")
    .select("id")
    .in("division_id", divisionIds);
  if (groupError) throw groupError;

  const groupIds = groups?.map((g) => g.id) ?? [];
  if (groupIds.length === 0) return new Set();

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .in("group_id", groupIds);
  if (teamError) throw teamError;

  return new Set(teams?.map((t) => t.id) ?? []);
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const groupId = new URL(request.url).searchParams.get("groupId");

    const seasonTeamIds = await activeSeasonTeamIds(supabase);

    let teamFilter: Set<string> = seasonTeamIds;
    if (groupId) {
      const { data: teams, error: teamError } = await supabase
        .from("teams")
        .select("id")
        .eq("group_id", groupId);
      if (teamError) return jsonError(teamError.message, 500);
      const groupTeamIds = new Set(teams?.map((t) => t.id) ?? []);
      teamFilter = new Set(
        [...seasonTeamIds].filter((id) => groupTeamIds.has(id)),
      );
    }

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

    const teamId = body.team_id as string | undefined;
    const penaltyDate = body.penalty_date as string | undefined;
    const reason = body.reason as string | undefined;
    const vpDeduction = Number(body.vp_deduction);

    if (!teamId || !penaltyDate || !reason?.trim()) {
      return jsonError("team_id, penalty_date, and reason are required", 400);
    }
    if (!Number.isFinite(vpDeduction) || vpDeduction < 0) {
      return jsonError("vp_deduction must be a non-negative number", 400);
    }

    const { data, error } = await supabase
      .from("penalties")
      .insert({
        team_id: teamId,
        penalty_date: penaltyDate,
        reason: reason.trim(),
        vp_deduction: vpDeduction,
        created_by: user.id,
      })
      .select("id, team_id, penalty_date, reason, vp_deduction, created_at")
      .single();

    if (error) return jsonError(error.message, 400);

    await revalidateStandingsForTeam(supabase, teamId);

    return jsonOk({ penalty: data }, { status: 201 });
  } catch (err) {
    return jsonFromError(err);
  }
}
