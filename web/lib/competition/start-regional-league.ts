import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureRegionalLeague } from "./ensure-regional-league";
import {
  assertCanStartRegionalLeague,
  fetchRegionalReadiness,
} from "./regional-readiness";
import { type RegionCode } from "./scopes";
import { generateGroupScheduleInDb } from "@/lib/scheduling/generate-group-schedule-db";

export type StartRegionalLeagueResult = {
  schedules: { label: string; matchesCreated: number }[];
  activated: true;
};

export async function startRegionalLeague(
  supabase: SupabaseClient,
  seasonId: string,
  regionCode: RegionCode,
  boardCount = 24,
): Promise<StartRegionalLeagueResult> {
  await ensureRegionalLeague(supabase, seasonId, regionCode);

  const readiness = await fetchRegionalReadiness(
    supabase,
    seasonId,
    regionCode,
  );
  assertCanStartRegionalLeague(readiness);

  const schedules: { label: string; matchesCreated: number }[] = [];

  for (const group of readiness.groups) {
    if (group.scheduleComplete) {
      schedules.push({
        label: `${group.divisionName} — ${group.groupName}`,
        matchesCreated: 0,
      });
      continue;
    }
    const result = await generateGroupScheduleInDb(
      supabase,
      group.groupId,
      boardCount,
    );
    schedules.push({
      label: `${group.divisionName} — ${group.groupName}`,
      matchesCreated: result.matchesCreated,
    });
  }

  const { error: seasonError } = await supabase
    .from("seasons")
    .update({ status: "active" })
    .eq("id", seasonId);
  if (seasonError) throw new Error(seasonError.message);

  if (readiness.leagueId) {
    const { data: divisions } = await supabase
      .from("divisions")
      .select("id")
      .eq("league_id", readiness.leagueId);
    const divisionIds = divisions?.map((d) => d.id) ?? [];
    if (divisionIds.length > 0) {
      await supabase
        .from("groups")
        .update({ status: "active" })
        .in("division_id", divisionIds)
        .eq("status", "setup");
    }
  }

  return { schedules, activated: true };
}
