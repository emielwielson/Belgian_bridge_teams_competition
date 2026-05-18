import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import {
  applyMatchDatesDivisionFilter,
  nationalMatchDatesDivisionId,
} from "@/lib/competition/match-dates-query";
import {
  collapseRoundsToMatchDays,
  expandMatchDaysToRounds,
  formatSlotTimesLabel,
  NATIONAL_MATCH_DAY_COUNTS,
} from "@/lib/competition/national-match-schedule";
import type { NationalScheduleKey } from "@/lib/competition/national-structure";
import { resolveRegionId } from "@/lib/competition/queries";
import { requireActiveSeason } from "@/lib/competition/season";
import { requireSeasonInSetup } from "@/lib/competition/season-setup";
import { parseScopeParam, SCOPES } from "@/lib/competition/scopes";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { parseBrusselsToUtc } from "@/lib/time/brussels";

function parseNationalScheduleKey(
  value: string | null | undefined,
): NationalScheduleKey | null {
  if (value === "honor" || value === "first" || value === "default") {
    return value;
  }
  return null;
}

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

    if (scope === SCOPES.NATIONAL) {
      const scheduleKey =
        parseNationalScheduleKey(searchParams.get("schedule")) ?? "default";
      const divisionId = await nationalMatchDatesDivisionId(
        supabase,
        season.id,
        scheduleKey,
      );
      datesQuery = applyMatchDatesDivisionFilter(datesQuery, divisionId);
    } else {
      datesQuery = datesQuery.is("division_id", null);
    }

    const { data, error } = await datesQuery;

    if (error) return jsonError(error.message, 500);

    if (scope === SCOPES.NATIONAL) {
      const scheduleKey =
        parseNationalScheduleKey(searchParams.get("schedule")) ?? "default";
      const matchDays = collapseRoundsToMatchDays(scheduleKey, data ?? []);
      return jsonOk({
        dates: data ?? [],
        matchDays,
        slotTimes: formatSlotTimesLabel(scheduleKey),
        matchDayCount: NATIONAL_MATCH_DAY_COUNTS[scheduleKey],
      });
    }

    return jsonOk({ dates: data ?? [] });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const season = await requireActiveSeason(supabase);
    requireSeasonInSetup(season);
    const body = await request.json();
    const scope = parseScopeParam(body.scope ?? "");
    if (!scope) return jsonError("Invalid scope", 400);

    const regionId = await resolveRegionId(
      supabase,
      scope,
      body.region ?? undefined,
    );

    let divisionId: string | null = null;
    let rounds: { round: number; datetime: string }[] = body.rounds ?? [];

    if (scope === SCOPES.NATIONAL) {
      const scheduleKey =
        parseNationalScheduleKey(body.schedule) ?? "default";
      divisionId = await nationalMatchDatesDivisionId(
        supabase,
        season.id,
        scheduleKey,
      );

      const matchDays: string[] = body.matchDays ?? [];
      const expectedDays = NATIONAL_MATCH_DAY_COUNTS[scheduleKey];
      if (matchDays.length !== expectedDays) {
        return jsonError(
          `Exactly ${expectedDays} match days required`,
          400,
        );
      }
      try {
        rounds = expandMatchDaysToRounds(scheduleKey, matchDays);
      } catch (err) {
        return jsonError(
          err instanceof Error ? err.message : "Invalid match days",
          400,
        );
      }
    } else if (rounds.length !== 14) {
      return jsonError("Exactly 14 round datetimes required", 400);
    }

    let deleteQuery = supabase
      .from("competition_match_dates")
      .delete()
      .eq("season_id", season.id)
      .eq("scope", scope);

    deleteQuery =
      scope === SCOPES.NATIONAL
        ? deleteQuery.is("region_id", null)
        : deleteQuery.eq("region_id", regionId!);

    deleteQuery = applyMatchDatesDivisionFilter(deleteQuery, divisionId);
    await deleteQuery;

    const rows = rounds.map((r) => ({
      season_id: season.id,
      scope,
      region_id: scope === SCOPES.NATIONAL ? null : regionId,
      division_id: divisionId,
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
