import type { SupabaseClient } from "@supabase/supabase-js";
import { generateGroupScheduleInDb } from "@/lib/scheduling/generate-group-schedule-db";
import { ensureNationalStructure } from "./ensure-national-structure";
import {
  assertCanStartNationalLeague,
  fetchNationalReadiness,
} from "./national-readiness";

export type StartNationalLeagueResult = {
  schedules: { divisionName: string; matchesCreated: number }[];
  activated: true;
};

export async function startNationalLeague(
  supabase: SupabaseClient,
  seasonId: string,
  boardCount = 24,
): Promise<StartNationalLeagueResult> {
  await ensureNationalStructure(supabase, seasonId);

  const readiness = await fetchNationalReadiness(supabase, seasonId);
  assertCanStartNationalLeague(readiness);

  const schedules: { divisionName: string; matchesCreated: number }[] = [];

  for (const div of readiness.divisions) {
    if (!div.groupId) {
      throw new Error(`${div.name}: group missing`);
    }
    const result = await generateGroupScheduleInDb(
      supabase,
      div.groupId,
      boardCount,
    );
    schedules.push({
      divisionName: div.name,
      matchesCreated: result.matchesCreated,
    });
  }

  const { error: seasonError } = await supabase
    .from("seasons")
    .update({ status: "active" })
    .eq("id", seasonId);
  if (seasonError) throw new Error(seasonError.message);

  const { data: leagues } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "national");

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

  return { schedules, activated: true };
}
