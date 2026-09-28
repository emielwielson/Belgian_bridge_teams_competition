import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureRegionalLeague } from "./ensure-regional-league";
import { REGION_CODES } from "./scopes";
import { ZWEIFFEL_DIVISION_SPECS } from "./zweiffel-data";

/** Ensure Zweiffel league + six flat divisions (one group each, group name = division name). */
export async function ensureZweiffelStructure(
  supabase: SupabaseClient,
  seasonId: string,
) {
  const { leagueId } = await ensureRegionalLeague(
    supabase,
    seasonId,
    REGION_CODES.ZWEIFFEL,
  );

  const { data: levels, error: levelsError } = await supabase
    .from("division_levels")
    .select("id, code");
  if (levelsError) throw levelsError;
  const levelByCode = new Map(levels?.map((l) => [l.code, l.id]) ?? []);

  const divisionIds: string[] = [];

  for (const spec of ZWEIFFEL_DIVISION_SPECS) {
    const levelId = levelByCode.get(spec.divisionLevelCode);
    if (!levelId) {
      throw new Error(`Missing division level: ${spec.divisionLevelCode}`);
    }

    const { data: existingDivision } = await supabase
      .from("divisions")
      .select("id")
      .eq("league_id", leagueId)
      .eq("name", spec.name)
      .maybeSingle();

    let divisionId = existingDivision?.id;
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
    } else {
      const { error: updateError } = await supabase
        .from("divisions")
        .update({ division_level_id: levelId })
        .eq("id", divisionId);
      if (updateError) throw updateError;
    }

    divisionIds.push(divisionId);

    const { data: existingGroup } = await supabase
      .from("groups")
      .select("id")
      .eq("division_id", divisionId)
      .eq("name", spec.name)
      .maybeSingle();

    if (!existingGroup) {
      const { error } = await supabase.from("groups").insert({
        division_id: divisionId,
        name: spec.name,
        max_matches_per_day_per_team: null,
        round_robin_count: spec.roundRobinCount,
        round_count: spec.roundCount,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("groups")
        .update({
          round_robin_count: spec.roundRobinCount,
          round_count: spec.roundCount,
        })
        .eq("id", existingGroup.id);
      if (error) throw error;
    }
  }

  return { leagueId, divisionIds };
}
