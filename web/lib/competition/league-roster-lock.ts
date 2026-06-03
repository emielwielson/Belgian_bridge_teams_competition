import type { SupabaseClient } from "@supabase/supabase-js";
import { NATIONAL_LEAGUE_NAME } from "./league-names";
import { type RegionCode } from "./scopes";

export class RosterLockedError extends Error {
  readonly status = 409;

  constructor(message = "Rosters are locked for this competition") {
    super(message);
    this.name = "RosterLockedError";
  }
}

export function requireRosterUnlocked(locked: boolean): void {
  if (locked) throw new RosterLockedError();
}

export async function isTeamRosterLocked(
  supabase: SupabaseClient,
  teamId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_team_roster_locked", {
    p_team_id: teamId,
  });
  if (error) throw error;
  return data === true;
}

export async function isGroupRosterLocked(
  supabase: SupabaseClient,
  groupId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_group_roster_locked", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return data === true;
}

export async function assertTeamRosterEditable(
  supabase: SupabaseClient,
  teamId: string,
): Promise<void> {
  requireRosterUnlocked(await isTeamRosterLocked(supabase, teamId));
}

export async function assertGroupRosterEditable(
  supabase: SupabaseClient,
  groupId: string,
): Promise<void> {
  requireRosterUnlocked(await isGroupRosterLocked(supabase, groupId));
}

export async function fetchLeagueRosterLock(
  supabase: SupabaseClient,
  leagueId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("leagues")
    .select("rosters_locked")
    .eq("id", leagueId)
    .maybeSingle();

  if (error) throw error;
  return data?.rosters_locked === true;
}

export async function setLeagueRostersLocked(
  supabase: SupabaseClient,
  leagueId: string,
  locked: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("leagues")
    .update({ rosters_locked: locked })
    .eq("id", leagueId);

  if (error) throw error;
}

export async function findNationalLeagueId(
  supabase: SupabaseClient,
  seasonId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "national")
    .eq("name", NATIONAL_LEAGUE_NAME)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function findRegionalLeagueId(
  supabase: SupabaseClient,
  seasonId: string,
  regionCode: RegionCode,
): Promise<string | null> {
  const { data: region, error: regionError } = await supabase
    .from("regions")
    .select("id")
    .eq("code", regionCode)
    .maybeSingle();

  if (regionError) throw regionError;
  if (!region) return null;

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "regional")
    .eq("region_id", region.id)
    .maybeSingle();

  if (leagueError) throw leagueError;
  return league?.id ?? null;
}
