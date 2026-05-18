import { createSessionClient } from "@/lib/supabase/server-client";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET() {
  try {
    const supabase = await createSessionClient();

    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();

    if (seasonError) return jsonError(seasonError.message, 500);
    if (!season) return jsonOk({ groups: [] });

    const { data: leagues, error: leaguesError } = await supabase
      .from("leagues")
      .select("id, name, scope")
      .eq("season_id", season.id);

    if (leaguesError) return jsonError(leaguesError.message, 500);

    const leagueIds = leagues?.map((l) => l.id) ?? [];
    if (leagueIds.length === 0) return jsonOk({ groups: [] });

    const { data: divisions, error: divisionsError } = await supabase
      .from("divisions")
      .select("id, name, league_id")
      .in("league_id", leagueIds);

    if (divisionsError) return jsonError(divisionsError.message, 500);

    const divisionIds = divisions?.map((d) => d.id) ?? [];
    if (divisionIds.length === 0) return jsonOk({ groups: [] });

    const { data: groups, error: groupsError } = await supabase
      .from("groups")
      .select("id, name, status, division_id")
      .in("division_id", divisionIds);

    if (groupsError) return jsonError(groupsError.message, 500);

    const leagueById = new Map(leagues?.map((l) => [l.id, l]) ?? []);
    const divisionById = new Map(divisions?.map((d) => [d.id, d]) ?? []);

    const enriched = (groups ?? []).map((group) => {
      const division = divisionById.get(group.division_id);
      const league = division ? leagueById.get(division.league_id) : undefined;
      return {
        ...group,
        division_name: division?.name,
        league_name: league?.name,
        league_scope: league?.scope,
      };
    });

    return jsonOk({ groups: enriched });
  } catch (err) {
    return jsonFromError(err);
  }
}
