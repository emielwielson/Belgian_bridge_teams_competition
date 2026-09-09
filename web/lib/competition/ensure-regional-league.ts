import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMPETITION_KIND_CODES,
  resolveCompetitionKindId,
  type CompetitionKindCode,
} from "@/lib/auth/competition-scope";
import { canonicalLeagueName } from "./league-names";
import { REGION_CODES, type RegionCode } from "./scopes";

function kindCodeForRegion(regionCode: RegionCode): CompetitionKindCode {
  return regionCode === REGION_CODES.WALLONIA
    ? COMPETITION_KIND_CODES.WALLONIA
    : COMPETITION_KIND_CODES.FLANDERS;
}

export async function ensureRegionalLeague(
  supabase: SupabaseClient,
  seasonId: string,
  regionCode: RegionCode,
) {
  const { data: region, error: regionError } = await supabase
    .from("regions")
    .select("id")
    .eq("code", regionCode)
    .single();
  if (regionError || !region) {
    throw new Error(`Region not found: ${regionCode}`);
  }

  const name = canonicalLeagueName("regional", regionCode);
  const competitionKindId = await resolveCompetitionKindId(
    supabase,
    kindCodeForRegion(regionCode),
  );

  const { data: existing } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "regional")
    .eq("region_id", region.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("leagues")
      .update({ name, competition_kind_id: competitionKindId })
      .eq("id", existing.id);
    return { leagueId: existing.id };
  }

  const { data: created, error } = await supabase
    .from("leagues")
    .insert({
      season_id: seasonId,
      scope: "regional",
      region_id: region.id,
      name,
      competition_kind_id: competitionKindId,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { leagueId: created.id };
}
