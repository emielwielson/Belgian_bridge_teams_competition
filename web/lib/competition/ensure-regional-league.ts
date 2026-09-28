import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COMPETITION_KIND_CODES,
  resolveCompetitionKindId,
  type CompetitionKindCode,
} from "@/lib/auth/competition-scope";
import { canonicalLeagueName } from "./league-names";
import { REGION_CODES, type RegionCode } from "./scopes";

function kindCodeForRegion(regionCode: RegionCode): CompetitionKindCode {
  if (regionCode === REGION_CODES.WALLONIA) {
    return COMPETITION_KIND_CODES.WALLONIA;
  }
  if (regionCode === REGION_CODES.ZWEIFFEL) {
    return COMPETITION_KIND_CODES.ZWEIFFEL;
  }
  return COMPETITION_KIND_CODES.FLANDERS;
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "23505" ||
    (typeof error.message === "string" &&
      error.message.toLowerCase().includes("duplicate"))
  );
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

  async function findExisting(): Promise<string | null> {
    const { data, error } = await supabase
      .from("leagues")
      .select("id")
      .eq("season_id", seasonId)
      .eq("scope", "regional")
      .eq("region_id", region.id)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }

  const existingId = await findExisting();
  if (existingId) {
    const { error: updateError } = await supabase
      .from("leagues")
      .update({ name, competition_kind_id: competitionKindId })
      .eq("id", existingId);
    if (updateError) throw updateError;
    return { leagueId: existingId };
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

  if (error) {
    // Concurrent ensure (e.g. React Strict Mode double mount) — reuse winner.
    if (isUniqueViolation(error)) {
      const racedId = await findExisting();
      if (racedId) return { leagueId: racedId };
    }
    throw error;
  }

  return { leagueId: created.id };
}
