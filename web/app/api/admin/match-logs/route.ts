import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { activeSeasonGroupIds } from "@/lib/competition/admin-season-scope";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const url = new URL(request.url);
    const groupId = url.searchParams.get("groupId");
    const matchId = url.searchParams.get("matchId");
    const actionPrefix = url.searchParams.get("action");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? 50), 1),
      200,
    );
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    let matchIds: string[] | null = null;

    if (matchId) {
      matchIds = [matchId];
    } else {
      const groupIds = groupId
        ? [groupId]
        : await activeSeasonGroupIds(supabase);
      if (groupIds.length === 0) return jsonOk({ logs: [], total: 0 });

      const { data: matches, error: matchError } = await supabase
        .from("matches")
        .select("id")
        .in("group_id", groupIds);
      if (matchError) return jsonError(matchError.message, 500);
      matchIds = matches?.map((m) => m.id) ?? [];
    }

    if (!matchIds || matchIds.length === 0) {
      return jsonOk({ logs: [], total: 0 });
    }

    let query = supabase
      .from("match_logs")
      .select(
        `
        id,
        match_id,
        action,
        user_id,
        created_at,
        match:matches (
          round,
          group_id,
          home_team:teams!matches_home_team_id_fkey (name),
          away_team:teams!matches_away_team_id_fkey (name)
        )
      `,
        { count: "exact" },
      )
      .in("match_id", matchIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (actionPrefix) {
      query = query.ilike("action", `${actionPrefix}%`);
    }
    if (from) {
      query = query.gte("created_at", from);
    }
    if (to) {
      query = query.lte("created_at", to);
    }

    const { data, error, count } = await query;
    if (error) return jsonError(error.message, 500);

    return jsonOk({ logs: data ?? [], total: count ?? 0 });
  } catch (err) {
    return jsonFromError(err);
  }
}
