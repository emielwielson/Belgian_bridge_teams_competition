import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { ensureNationalStructure } from "@/lib/competition/ensure-national-structure";
import { ensureRegionalLeague } from "@/lib/competition/ensure-regional-league";
import { canonicalLeagueName } from "@/lib/competition/league-names";
import { requireActiveSeason } from "@/lib/competition/season";
import {
  findNationalLeagueId,
  findRegionalLeagueId,
  setLeagueRostersLocked,
} from "@/lib/competition/league-roster-lock";
import { requireSeasonInSetup } from "@/lib/competition/season-setup";
import {
  parseRegionParam,
  SCOPES,
  type RegionCode,
} from "@/lib/competition/scopes";
import { startNationalLeague } from "@/lib/competition/start-national-league";
import { startRegionalLeague } from "@/lib/competition/start-regional-league";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

export async function GET() {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const season = await requireActiveSeason(supabase);

    const { data: leagues, error: leaguesError } = await supabase
      .from("leagues")
      .select("id, name, scope, region_id, season_id, rosters_locked")
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
              "id, name, status, division_id, max_matches_per_day_per_team, round_count, round_robin_count",
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
      const scope = body.scope === SCOPES.REGIONAL ? SCOPES.REGIONAL : SCOPES.NATIONAL;
      let regionCode: RegionCode | undefined;
      if (scope === SCOPES.REGIONAL) {
        if (!body.region_id) {
          return jsonErrorCode(ErrorCodes.api.regionIdRequired, 400);
        }
        const { data: region } = await supabase
          .from("regions")
          .select("code")
          .eq("id", body.region_id)
          .single();
        regionCode = parseRegionParam(region?.code ?? "") ?? undefined;
        if (!regionCode) return jsonErrorCode(ErrorCodes.api.invalidRegion, 400);
      }
      const expectedName = canonicalLeagueName(scope, regionCode);
      if (body.name !== expectedName) {
        return jsonErrorCode(ErrorCodes.api.leagueNameMustBe, 400, {
          expectedName,
        });
      }

      const { data, error } = await supabase
        .from("leagues")
        .insert({
          season_id: season.id,
          name: expectedName,
          scope,
          region_id: body.region_id ?? null,
        })
        .select()
        .single();
      if (error) return jsonError(error.message, 400);
      return jsonOk({ league: data }, { status: 201 });
    }

    if (body.type === "division") {
      requireSeasonInSetup(season);
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
      requireSeasonInSetup(season);
      const roundRobinCount =
        typeof body.round_robin_count === "number" ? body.round_robin_count : 2;
      const { data, error } = await supabase
        .from("groups")
        .insert({
          division_id: body.division_id,
          name: body.name,
          max_matches_per_day_per_team: body.max_matches_per_day_per_team ?? null,
          round_robin_count: roundRobinCount,
        })
        .select()
        .single();
      if (error) return jsonError(error.message, 400);
      return jsonOk({ group: data }, { status: 201 });
    }

    return jsonErrorCode(ErrorCodes.api.invalidType, 400);
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

    if (body.action === "ensure_regional_league") {
      const season = await requireActiveSeason(supabase);
      const regionCode = parseRegionParam(body.regionCode ?? "");
      if (!regionCode) return jsonErrorCode(ErrorCodes.api.invalidRegionCode, 400);
      const result = await ensureRegionalLeague(
        supabase,
        season.id,
        regionCode,
      );
      return jsonOk({ ensured: true, ...result });
    }

    if (body.action === "start_national_league") {
      const season = await requireActiveSeason(supabase);
      const boardCount =
        typeof body.boardCount === "number" ? body.boardCount : 24;
      const result = await startNationalLeague(
        supabase,
        season.id,
        boardCount,
      );
      return jsonOk(result);
    }

    if (
      body.action === "lock_national_rosters" ||
      body.action === "unlock_national_rosters"
    ) {
      const season = await requireActiveSeason(supabase);
      const leagueId = await findNationalLeagueId(supabase, season.id);
      if (!leagueId) {
        return jsonErrorCode(ErrorCodes.api.invalidPatch, 400);
      }
      await setLeagueRostersLocked(
        supabase,
        leagueId,
        body.action === "lock_national_rosters",
      );
      return jsonOk({
        rostersLocked: body.action === "lock_national_rosters",
      });
    }

    if (
      body.action === "lock_regional_rosters" ||
      body.action === "unlock_regional_rosters"
    ) {
      const season = await requireActiveSeason(supabase);
      const regionCode = parseRegionParam(body.regionCode ?? "");
      if (!regionCode) {
        return jsonErrorCode(ErrorCodes.api.invalidRegionCode, 400);
      }
      const leagueId = await findRegionalLeagueId(
        supabase,
        season.id,
        regionCode,
      );
      if (!leagueId) {
        return jsonErrorCode(ErrorCodes.api.invalidPatch, 400);
      }
      await setLeagueRostersLocked(
        supabase,
        leagueId,
        body.action === "lock_regional_rosters",
      );
      return jsonOk({
        rostersLocked: body.action === "lock_regional_rosters",
      });
    }

    if (body.action === "start_regional_league") {
      const season = await requireActiveSeason(supabase);
      const regionCode = parseRegionParam(body.regionCode ?? "");
      if (!regionCode) {
        return jsonErrorCode(ErrorCodes.api.invalidRegionCode, 400);
      }
      const boardCount =
        typeof body.boardCount === "number" ? body.boardCount : 24;
      const result = await startRegionalLeague(
        supabase,
        season.id,
        regionCode,
        boardCount,
      );
      return jsonOk(result);
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
      const season = await requireActiveSeason(supabase);
      requireSeasonInSetup(season);
      const { error } = await supabase
        .from("divisions")
        .update({ name: body.name })
        .eq("id", body.id);
      if (error) return jsonError(error.message, 400);
      return jsonOk({ updated: true });
    }

    if (body.type === "group" && body.id) {
      const season = await requireActiveSeason(supabase);
      requireSeasonInSetup(season);
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.status !== undefined) patch.status = body.status;
      if (body.max_matches_per_day_per_team !== undefined) {
        patch.max_matches_per_day_per_team = body.max_matches_per_day_per_team;
      }
      if (body.round_robin_count !== undefined) {
        patch.round_robin_count = body.round_robin_count;
      }
      const { error } = await supabase
        .from("groups")
        .update(patch)
        .eq("id", body.id);
      if (error) return jsonError(error.message, 400);

      if (body.round_robin_count !== undefined) {
        const { error: syncError } = await supabase.rpc("sync_group_round_count", {
          p_group_id: body.id,
        });
        if (syncError) return jsonError(syncError.message, 400);
      }

      return jsonOk({ updated: true });
    }

    return jsonErrorCode(ErrorCodes.api.invalidPatch, 400);
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const season = await requireActiveSeason(supabase);
    requireSeasonInSetup(season);
    const body = await request.json();

    if (body.type === "group" && body.id) {
      const groupId = body.id as string;
      const { count } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId);
      if ((count ?? 0) > 0) {
        return jsonErrorCode(ErrorCodes.api.cannotDeleteGroupWithMatches, 409);
      }

      const { data: teams } = await supabase
        .from("teams")
        .select("id")
        .eq("group_id", groupId);
      const teamIds = teams?.map((t) => t.id) ?? [];

      if (teamIds.length > 0) {
        await supabase.from("penalties").delete().in("team_id", teamIds);
        await supabase.from("warnings").delete().in("team_id", teamIds);
        const { error: rosterError } = await supabase
          .from("team_players")
          .delete()
          .in("team_id", teamIds);
        if (rosterError) return jsonError(rosterError.message, 400);

        const { error: teamsError } = await supabase
          .from("teams")
          .delete()
          .eq("group_id", groupId);
        if (teamsError) return jsonError(teamsError.message, 400);
      }

      const { error } = await supabase.from("groups").delete().eq("id", groupId);
      if (error) return jsonError(error.message, 400);
      return jsonOk({ deleted: true });
    }

    return jsonErrorCode(ErrorCodes.api.invalidDelete, 400);
  } catch (err) {
    return jsonFromError(err);
  }
}
