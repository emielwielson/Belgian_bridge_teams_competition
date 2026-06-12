import type { SupabaseClient } from "@supabase/supabase-js";
import { requireActiveSeason } from "./season";

export async function groupIdsForSeason(
  supabase: SupabaseClient,
  seasonId: string,
): Promise<string[]> {
  const { data: leagues, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId);
  if (leagueError) throw leagueError;

  const leagueIds = leagues?.map((l) => l.id) ?? [];
  if (leagueIds.length === 0) return [];

  const { data: divisions, error: divError } = await supabase
    .from("divisions")
    .select("id")
    .in("league_id", leagueIds);
  if (divError) throw divError;

  const divisionIds = divisions?.map((d) => d.id) ?? [];
  if (divisionIds.length === 0) return [];

  const { data: groups, error: groupError } = await supabase
    .from("groups")
    .select("id")
    .in("division_id", divisionIds);
  if (groupError) throw groupError;

  return groups?.map((g) => g.id) ?? [];
}

export async function activeSeasonGroupIds(
  supabase: SupabaseClient,
): Promise<string[]> {
  const season = await requireActiveSeason(supabase);
  return groupIdsForSeason(supabase, season.id);
}

export async function activeSeasonTeamIds(
  supabase: SupabaseClient,
  groupId?: string | null,
): Promise<Set<string>> {
  const groupIds = groupId
    ? [groupId]
    : await activeSeasonGroupIds(supabase);

  if (groupIds.length === 0) return new Set();

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .in("group_id", groupIds);
  if (teamError) throw teamError;

  return new Set(teams?.map((t) => t.id) ?? []);
}

export async function activeSeasonMatchIds(
  supabase: SupabaseClient,
  groupId?: string | null,
): Promise<Set<string>> {
  const groupIds = groupId
    ? [groupId]
    : await activeSeasonGroupIds(supabase);

  if (groupIds.length === 0) return new Set();

  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select("id")
    .in("group_id", groupIds);
  if (matchError) throw matchError;

  return new Set(matches?.map((m) => m.id) ?? []);
}
