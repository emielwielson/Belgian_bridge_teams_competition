import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { resolveRegionId } from "@/lib/competition/queries";
import { requireActiveSeason } from "@/lib/competition/season";
import { parseRegionParam, parseScopeParam, SCOPES } from "@/lib/competition/scopes";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { parseBrusselsToUtc } from "@/lib/time/brussels";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const season = await requireActiveSeason(supabase);
    const { searchParams } = new URL(request.url);
    const scope = parseScopeParam(searchParams.get("scope") ?? "");
    if (!scope) return jsonError("Invalid scope", 400);

    const regionCode = searchParams.get("region") ?? undefined;
    const regionId = await resolveRegionId(supabase, scope, regionCode ?? undefined);

    let datesQuery = supabase
      .from("competition_match_dates")
      .select("id, round, datetime, scope, region_id")
      .eq("season_id", season.id)
      .eq("scope", scope)
      .order("round");

    datesQuery =
      scope === SCOPES.NATIONAL
        ? datesQuery.is("region_id", null)
        : datesQuery.eq("region_id", regionId!);

    const { data, error } = await datesQuery;

    if (error) return jsonError(error.message, 500);
    return jsonOk({ dates: data ?? [] });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const season = await requireActiveSeason(supabase);
    const body = await request.json();
    const scope = parseScopeParam(body.scope ?? "");
    if (!scope) return jsonError("Invalid scope", 400);

    const regionId = await resolveRegionId(
      supabase,
      scope,
      body.region ?? undefined,
    );

    const rounds: { round: number; datetime: string }[] = body.rounds ?? [];
    if (rounds.length !== 14) {
      return jsonError("Exactly 14 round datetimes required", 400);
    }

    await supabase
      .from("competition_match_dates")
      .delete()
      .eq("season_id", season.id)
      .eq("scope", scope)
      .is("region_id", scope === SCOPES.NATIONAL ? null : regionId);

    const rows = rounds.map((r) => ({
      season_id: season.id,
      scope,
      region_id: scope === SCOPES.NATIONAL ? null : regionId,
      round: r.round,
      datetime: r.datetime.includes("T")
        ? parseBrusselsToUtc(r.datetime)
        : r.datetime,
    }));

    const { data, error } = await supabase
      .from("competition_match_dates")
      .insert(rows)
      .select("id, round, datetime");

    if (error) return jsonError(error.message, 400);
    return jsonOk({ dates: data });
  } catch (err) {
    return jsonFromError(err);
  }
}
