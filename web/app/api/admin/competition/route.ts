import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { ensureNationalStructure } from "@/lib/competition/ensure-national-structure";
import { requireActiveSeason } from "@/lib/competition/season";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET() {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const season = await requireActiveSeason(supabase);

    const { data: leagues, error: leaguesError } = await supabase
      .from("leagues")
      .select("id, name, scope, region_id, season_id")
      .eq("season_id", season.id)
      .order("name");

    if (leaguesError) return jsonError(leaguesError.message, 500);

    const leagueIds = leagues?.map((l) => l.id) ?? [];
    const { data: divisionLevels } = await supabase
      .from("division_levels")
      .select("id, code, name, sort_order")
      .order("sort_order");

    if (leagueIds.length === 0) {
      return jsonOk({ season, divisionLevels: divisionLevels ?? [], leagues: [] });
    }

    const { data: divisions, error: divError } = await supabase
      .from("divisions")
      .select("id, name, league_id, division_level_id")
      .in("league_id", leagueIds);

    if (divError) return jsonError(divError.message, 500);

    const divisionIds = divisions?.map((d) => d.id) ?? [];
    const { data: groups, error: groupsError } =
      divisionIds.length > 0
        ? await supabase
            .from("groups")
            .select(
              "id, name, status, division_id, max_matches_per_day_per_team",
            )
            .in("division_id", divisionIds)
        : { data: [], error: null };

    if (groupsError) return jsonError(groupsError.message, 500);

    const tree = (leagues ?? []).map((league) => ({
      ...league,
      divisions: (divisions ?? [])
        .filter((d) => d.league_id === league.id)
        .map((division) => ({
          ...division,
          groups: (groups ?? []).filter((g) => g.division_id === division.id),
        })),
    }));

    return jsonOk({
      season,
      divisionLevels: divisionLevels ?? [],
      leagues: tree,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const season = await requireActiveSeason(supabase);
    const body = await request.json();

    if (body.type === "league") {
      const { data, error } = await supabase
        .from("leagues")
        .insert({
          season_id: season.id,
          name: body.name,
          scope: body.scope,
          region_id: body.region_id ?? null,
        })
        .select()
        .single();
      if (error) return jsonError(error.message, 400);
      return jsonOk({ league: data }, { status: 201 });
    }

    if (body.type === "division") {
      const { data, error } = await supabase
        .from("divisions")
        .insert({
          league_id: body.league_id,
          division_level_id: body.division_level_id,
          name: body.name,
        })
        .select()
        .single();
      if (error) return jsonError(error.message, 400);
      return jsonOk({ division: data }, { status: 201 });
    }

    if (body.type === "group") {
      const { data, error } = await supabase
        .from("groups")
        .insert({
          division_id: body.division_id,
          name: body.name,
          max_matches_per_day_per_team: body.max_matches_per_day_per_team ?? null,
        })
        .select()
        .single();
      if (error) return jsonError(error.message, 400);
      return jsonOk({ group: data }, { status: 201 });
    }

    return jsonError("Invalid type", 400);
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();

    if (body.action === "ensure_national_structure") {
      const season = await requireActiveSeason(supabase);
      const result = await ensureNationalStructure(supabase, season.id);
      return jsonOk({ ensured: true, ...result });
    }

    if (body.action === "activate_season") {
      const season = await requireActiveSeason(supabase);
      const { error } = await supabase
        .from("seasons")
        .update({ status: "active" })
        .eq("id", season.id);
      if (error) return jsonError(error.message, 400);

      if (body.activate_groups) {
        const { data: leagues } = await supabase
          .from("leagues")
          .select("id")
          .eq("season_id", season.id);
        const leagueIds = leagues?.map((l) => l.id) ?? [];
        if (leagueIds.length > 0) {
          const { data: divisions } = await supabase
            .from("divisions")
            .select("id")
            .in("league_id", leagueIds);
          const divisionIds = divisions?.map((d) => d.id) ?? [];
          if (divisionIds.length > 0) {
            await supabase
              .from("groups")
              .update({ status: "active" })
              .in("division_id", divisionIds)
              .eq("status", "setup");
          }
        }
      }
      return jsonOk({ activated: true });
    }

    if (body.type === "league" && body.id) {
      const { error } = await supabase
        .from("leagues")
        .update({ name: body.name })
        .eq("id", body.id);
      if (error) return jsonError(error.message, 400);
      return jsonOk({ updated: true });
    }

    if (body.type === "division" && body.id) {
      const { error } = await supabase
        .from("divisions")
        .update({ name: body.name })
        .eq("id", body.id);
      if (error) return jsonError(error.message, 400);
      return jsonOk({ updated: true });
    }

    if (body.type === "group" && body.id) {
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.status !== undefined) patch.status = body.status;
      if (body.max_matches_per_day_per_team !== undefined) {
        patch.max_matches_per_day_per_team = body.max_matches_per_day_per_team;
      }
      const { error } = await supabase
        .from("groups")
        .update(patch)
        .eq("id", body.id);
      if (error) return jsonError(error.message, 400);
      return jsonOk({ updated: true });
    }

    return jsonError("Invalid patch", 400);
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const body = await request.json();

    if (body.type === "group" && body.id) {
      const { count } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("group_id", body.id);
      if ((count ?? 0) > 0) {
        return jsonError("Cannot delete group with matches", 409);
      }
      const { error } = await supabase.from("groups").delete().eq("id", body.id);
      if (error) return jsonError(error.message, 400);
      return jsonOk({ deleted: true });
    }

    return jsonError("Invalid delete", 400);
  } catch (err) {
    return jsonFromError(err);
  }
}
