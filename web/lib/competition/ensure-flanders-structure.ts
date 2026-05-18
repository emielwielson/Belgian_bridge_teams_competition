import type { SupabaseClient } from "@supabase/supabase-js";
import { computeRoundCount } from "@/lib/scheduling/round-robin-schedule";
import {
  FLANDERS_DEMO_GROUPS,
  FLANDERS_DIVISIONS,
  flandersDivisionName,
} from "./demo-flanders-data";
import { ensureRegionalLeague } from "./ensure-regional-league";

export async function ensureFlandersStructure(
  supabase: SupabaseClient,
  seasonId: string,
) {
  const { leagueId } = await ensureRegionalLeague(
    supabase,
    seasonId,
    "flanders",
  );

  const { data: levels, error: levelsError } = await supabase
    .from("division_levels")
    .select("id, code");
  if (levelsError) throw levelsError;
  const levelByCode = new Map(levels?.map((l) => [l.code, l.id]) ?? []);

  const divisionIds = new Map<string, string>();

  for (const spec of FLANDERS_DIVISIONS) {
    const levelId = levelByCode.get(spec.divisionLevelCode);
    if (!levelId) {
      throw new Error(`Missing division level: ${spec.divisionLevelCode}`);
    }

    const { data: existing } = await supabase
      .from("divisions")
      .select("id")
      .eq("league_id", leagueId)
      .eq("name", spec.name)
      .maybeSingle();

    let divisionId = existing?.id;
    if (!divisionId) {
      const { data: created, error } = await supabase
        .from("divisions")
        .insert({
          league_id: leagueId,
          division_level_id: levelId,
          name: spec.name,
        })
        .select("id")
        .single();
      if (error) throw error;
      divisionId = created.id;
    }
    divisionIds.set(spec.name, divisionId);
  }

  for (const groupSpec of FLANDERS_DEMO_GROUPS) {
    const divisionName = flandersDivisionName(groupSpec.liga);
    const divisionId = divisionIds.get(divisionName);
    if (!divisionId) {
      throw new Error(`Missing division: ${divisionName}`);
    }

    const { data: existingGroup } = await supabase
      .from("groups")
      .select("id, round_count")
      .eq("division_id", divisionId)
      .eq("name", groupSpec.groupCode)
      .maybeSingle();

    const roundCount = computeRoundCount(
      groupSpec.teams.length,
      groupSpec.roundRobinCount,
    );

    if (!existingGroup) {
      const { error } = await supabase.from("groups").insert({
        division_id: divisionId,
        name: groupSpec.groupCode,
        max_matches_per_day_per_team: null,
        round_robin_count: groupSpec.roundRobinCount,
        round_count: roundCount,
      });
      if (error) throw error;
    } else {
      await supabase
        .from("groups")
        .update({
          round_robin_count: groupSpec.roundRobinCount,
          round_count: roundCount,
        })
        .eq("id", existingGroup.id);
    }
  }

  return { leagueId, divisionIds };
}
