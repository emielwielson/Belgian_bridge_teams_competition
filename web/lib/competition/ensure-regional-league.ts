import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalLeagueName } from "./league-names";
import { type RegionCode } from "./scopes";

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

  const { data: existing } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "regional")
    .eq("region_id", region.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("leagues").update({ name }).eq("id", existing.id);
    return { leagueId: existing.id };
  }

  const { data: created, error } = await supabase
    .from("leagues")
    .insert({
      season_id: seasonId,
      scope: "regional",
      region_id: region.id,
      name,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { leagueId: created.id };
}
