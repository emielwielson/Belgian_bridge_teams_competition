import type { SupabaseClient } from "@supabase/supabase-js";
import { NATIONAL_LEAGUE_NAME } from "./league-names";
import {
  NATIONAL_DIVISIONS,
  type NationalScheduleKey,
} from "./national-structure";

export async function ensureNationalStructure(
  supabase: SupabaseClient,
  seasonId: string,
) {
  const { data: levels, error: levelsError } = await supabase
    .from("division_levels")
    .select("id, code");

  if (levelsError) throw levelsError;
  const levelByCode = new Map(levels?.map((l) => [l.code, l.id]) ?? []);

  let { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "national")
    .eq("name", NATIONAL_LEAGUE_NAME)
    .maybeSingle();

  if (!league) {
    const { data: legacyNational } = await supabase
      .from("leagues")
      .select("id")
      .eq("season_id", seasonId)
      .eq("scope", "national")
      .limit(1)
      .maybeSingle();

    if (legacyNational) {
      const { error: renameError } = await supabase
        .from("leagues")
        .update({ name: NATIONAL_LEAGUE_NAME })
        .eq("id", legacyNational.id);
      if (renameError) throw renameError;
      league = legacyNational;
    } else {
      const { data: created, error } = await supabase
        .from("leagues")
        .insert({
          season_id: seasonId,
          scope: "national",
          region_id: null,
          name: NATIONAL_LEAGUE_NAME,
        })
        .select("id")
        .single();
      if (error) throw error;
      league = created;
    }
  }

  const divisionIds = new Map<string, string>();

  for (const spec of NATIONAL_DIVISIONS) {
    const levelId = levelByCode.get(spec.divisionLevelCode);
    if (!levelId) {
      throw new Error(`Missing division level: ${spec.divisionLevelCode}`);
    }

    const { data: existingDivision } = await supabase
      .from("divisions")
      .select("id")
      .eq("league_id", league.id)
      .eq("name", spec.name)
      .maybeSingle();

    let divisionId = existingDivision?.id;

    if (!divisionId) {
      const { data: createdDivision, error: divError } = await supabase
        .from("divisions")
        .insert({
          league_id: league.id,
          division_level_id: levelId,
          name: spec.name,
        })
        .select("id")
        .single();
      if (divError) throw divError;
      divisionId = createdDivision.id;
    }

    divisionIds.set(spec.name, divisionId);

    const { data: existingGroup } = await supabase
      .from("groups")
      .select("id, max_matches_per_day_per_team, round_count")
      .eq("division_id", divisionId)
      .eq("name", spec.name)
      .maybeSingle();

    if (!existingGroup) {
      const { error: groupError } = await supabase.from("groups").insert({
        division_id: divisionId,
        name: spec.name,
        max_matches_per_day_per_team: spec.maxMatchesPerDay,
        round_count: spec.roundCount,
      });
      if (groupError) throw groupError;
    } else {
      const patch: {
        max_matches_per_day_per_team: number | null;
        round_count?: number;
      } = {
        max_matches_per_day_per_team: spec.maxMatchesPerDay,
      };
      if (existingGroup.round_count !== spec.roundCount) {
        patch.round_count = spec.roundCount;
      }
      if (
        existingGroup.max_matches_per_day_per_team !== spec.maxMatchesPerDay ||
        patch.round_count !== undefined
      ) {
        await supabase.from("groups").update(patch).eq("id", existingGroup.id);
      }
    }
  }

  return { leagueId: league.id, divisionIds };
}

export async function resolveNationalScheduleDivisionId(
  supabase: SupabaseClient,
  seasonId: string,
  scheduleKey: NationalScheduleKey,
): Promise<string | null> {
  if (scheduleKey === "default") return null;

  const spec = NATIONAL_DIVISIONS.find((d) => d.scheduleKey === scheduleKey);
  if (!spec) return null;

  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "national")
    .eq("name", NATIONAL_LEAGUE_NAME)
    .maybeSingle();

  if (!league) return null;

  const { data: division } = await supabase
    .from("divisions")
    .select("id")
    .eq("league_id", league.id)
    .eq("name", spec.name)
    .maybeSingle();

  return division?.id ?? null;
}

export function scheduleKeyForDivisionName(
  divisionName: string,
): NationalScheduleKey {
  if (divisionName === "Honor") return "honor";
  if (divisionName === "1st Division") return "first";
  return "default";
}
