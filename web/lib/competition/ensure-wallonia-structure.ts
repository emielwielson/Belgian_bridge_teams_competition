import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WALLONIA_SUPERLEAGUE_DIVISION,
  WALLONIA_SUPERLEAGUE_SPECS,
} from "./lbf-wallonia-data";
import { ensureRegionalLeague } from "./ensure-regional-league";
import { REGION_CODES } from "./scopes";

export async function ensureWalloniaStructure(
  supabase: SupabaseClient,
  seasonId: string,
) {
  const { leagueId } = await ensureRegionalLeague(
    supabase,
    seasonId,
    REGION_CODES.WALLONIA,
  );

  const { data: levels, error: levelsError } = await supabase
    .from("division_levels")
    .select("id, code");
  if (levelsError) throw levelsError;
  const levelByCode = new Map(levels?.map((l) => [l.code, l.id]) ?? []);

  const firstLevelId = levelByCode.get("first");
  if (!firstLevelId) {
    throw new Error("Missing division level: first");
  }

  const { data: existingDivision } = await supabase
    .from("divisions")
    .select("id")
    .eq("league_id", leagueId)
    .eq("name", WALLONIA_SUPERLEAGUE_DIVISION)
    .maybeSingle();

  let divisionId = existingDivision?.id;
  if (!divisionId) {
    const { data: created, error } = await supabase
      .from("divisions")
      .insert({
        league_id: leagueId,
        division_level_id: firstLevelId,
        name: WALLONIA_SUPERLEAGUE_DIVISION,
      })
      .select("id")
      .single();
    if (error) throw error;
    divisionId = created.id;
  } else {
    const { error: updateError } = await supabase
      .from("divisions")
      .update({ division_level_id: firstLevelId })
      .eq("id", divisionId);
    if (updateError) throw updateError;
  }

  for (const spec of WALLONIA_SUPERLEAGUE_SPECS) {
    const { data: existingGroup } = await supabase
      .from("groups")
      .select("id")
      .eq("division_id", divisionId)
      .eq("name", spec.groupCode)
      .maybeSingle();

    if (!existingGroup) {
      const { error } = await supabase.from("groups").insert({
        division_id: divisionId,
        name: spec.groupCode,
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

  return { leagueId, divisionId };
}
