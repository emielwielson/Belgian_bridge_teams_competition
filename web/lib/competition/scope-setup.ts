import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRegionId } from "./queries";
import { SCOPES, type CompetitionScope, type RegionCode } from "./scopes";

export class SetupLockedError extends Error {
  readonly status = 409;

  constructor(message = "Competition setup is locked") {
    super(message);
    this.name = "SetupLockedError";
  }
}

export type CompetitionUnit =
  | { scope: typeof SCOPES.NATIONAL }
  | { scope: typeof SCOPES.REGIONAL; regionCode: RegionCode };

export type LeagueRow = {
  id: string;
  status: string;
  scope: string;
  region_id: string | null;
  season_id: string;
};

export function isScopeSetupLocked(leagueStatus: string): boolean {
  return leagueStatus !== "setup";
}

export function requireScopeInSetup(leagueStatus: string): void {
  if (isScopeSetupLocked(leagueStatus)) {
    throw new SetupLockedError();
  }
}

export async function resolveLeagueForUnit(
  supabase: SupabaseClient,
  seasonId: string,
  unit: CompetitionUnit,
): Promise<LeagueRow | null> {
  let query = supabase
    .from("leagues")
    .select("id, status, scope, region_id, season_id")
    .eq("season_id", seasonId)
    .eq("scope", unit.scope);

  if (unit.scope === SCOPES.REGIONAL) {
    const regionId = await resolveRegionId(supabase, SCOPES.REGIONAL, unit.regionCode);
    if (!regionId) return null;
    query = query.eq("region_id", regionId);
  } else {
    query = query.is("region_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getLeagueById(
  supabase: SupabaseClient,
  leagueId: string,
): Promise<LeagueRow | null> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id, status, scope, region_id, season_id")
    .eq("id", leagueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getLeagueForDivision(
  supabase: SupabaseClient,
  divisionId: string,
): Promise<LeagueRow | null> {
  const { data, error } = await supabase
    .from("divisions")
    .select(
      `
      league:leagues (
        id,
        status,
        scope,
        region_id,
        season_id
      )
    `,
    )
    .eq("id", divisionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const rawLeague = data?.league as unknown;
  if (!rawLeague) return null;
  return (Array.isArray(rawLeague) ? rawLeague[0] : rawLeague) as LeagueRow;
}

export async function getLeagueForGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<LeagueRow | null> {
  const { data, error } = await supabase
    .from("groups")
    .select(
      `
      division:divisions (
        league:leagues (
          id,
          status,
          scope,
          region_id,
          season_id
        )
      )
    `,
    )
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const rawDivision = data?.division as unknown;
  if (!rawDivision) return null;
  const division = (Array.isArray(rawDivision) ? rawDivision[0] : rawDivision) as {
    league: LeagueRow | LeagueRow[];
  };
  const league = Array.isArray(division.league) ? division.league[0] : division.league;
  return league ?? null;
}

export async function requireUnitInSetup(
  supabase: SupabaseClient,
  seasonId: string,
  unit: CompetitionUnit,
): Promise<LeagueRow> {
  const league = await resolveLeagueForUnit(supabase, seasonId, unit);
  if (!league) {
    throw new SetupLockedError();
  }
  requireScopeInSetup(league.status);
  return league;
}

export async function requireLeagueIdInSetup(
  supabase: SupabaseClient,
  leagueId: string,
): Promise<LeagueRow> {
  const league = await getLeagueById(supabase, leagueId);
  if (!league) {
    throw new SetupLockedError();
  }
  requireScopeInSetup(league.status);
  return league;
}

export async function requireGroupInSetup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<LeagueRow> {
  const league = await getLeagueForGroup(supabase, groupId);
  if (!league) {
    throw new SetupLockedError();
  }
  requireScopeInSetup(league.status);
  return league;
}

export async function requireDivisionInSetup(
  supabase: SupabaseClient,
  divisionId: string,
): Promise<LeagueRow> {
  const league = await getLeagueForDivision(supabase, divisionId);
  if (!league) {
    throw new SetupLockedError();
  }
  requireScopeInSetup(league.status);
  return league;
}

export function unitFromScope(
  scope: CompetitionScope,
  regionCode?: RegionCode,
): CompetitionUnit {
  if (scope === SCOPES.NATIONAL) {
    return { scope: SCOPES.NATIONAL };
  }
  if (!regionCode) {
    throw new Error("region required for regional scope");
  }
  return { scope: SCOPES.REGIONAL, regionCode };
}
