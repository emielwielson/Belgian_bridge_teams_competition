import type { SupabaseClient } from "@supabase/supabase-js";
import { SCOPES, type CompetitionScope } from "./scopes";

export async function resolveRegionId(
  supabase: SupabaseClient,
  scope: CompetitionScope,
  regionCode?: string,
): Promise<string | null> {
  if (scope === SCOPES.NATIONAL) return null;
  if (!regionCode) throw new Error("region required for regional scope");
  const { data, error } = await supabase
    .from("regions")
    .select("id")
    .eq("code", regionCode)
    .single();
  if (error) throw error;
  return data.id;
}

export async function getGroupLeagueContext(
  supabase: SupabaseClient,
  groupId: string,
) {
  const { data, error } = await supabase
    .from("groups")
    .select(
      `
      id,
      name,
      status,
      division:divisions (
        id,
        league:leagues (
          id,
          season_id,
          scope,
          region_id
        )
      )
    `,
    )
    .eq("id", groupId)
    .single();

  if (error) throw error;
  const rawDivision = data.division as unknown;
  const division = (Array.isArray(rawDivision) ? rawDivision[0] : rawDivision) as {
    id: string;
    league: {
      id: string;
      season_id: string;
      scope: string;
      region_id: string | null;
    } | {
      id: string;
      season_id: string;
      scope: string;
      region_id: string | null;
    }[];
  };
  const league = Array.isArray(division.league)
    ? division.league[0]
    : division.league;
  return {
    groupId: data.id,
    groupName: data.name,
    groupStatus: data.status,
    divisionId: division.id,
    league,
  };
}
