import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAllRows } from "@/lib/supabase/select-all";
import { requireActiveSeason } from "./season";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

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

  const { data: groups, error: groupError } = await selectAllRows<{ id: string }>(
    (from, to) =>
      supabase
        .from("groups")
        .select("id")
        .in("division_id", divisionIds)
        .order("id")
        .range(from, to),
  );
  if (groupError) throw groupError;

  return groups.map((g) => g.id);
}

export async function activeSeasonGroupIds(
  supabase: SupabaseClient,
): Promise<string[]> {
  const season = await requireActiveSeason(supabase);
  return groupIdsForSeason(supabase, season.id);
}

/** True when the group's league belongs to the active season. */
export async function isGroupInActiveSeason(
  supabase: SupabaseClient,
  groupId: string,
): Promise<boolean> {
  const season = await requireActiveSeason(supabase);

  const { data, error } = await supabase
    .from("groups")
    .select(
      `
      id,
      division:divisions (
        league:leagues (season_id)
      )
    `,
    )
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;

  const division = firstRelation(
    data.division as
      | { league: { season_id: string } | { season_id: string }[] }
      | { league: { season_id: string } | { season_id: string }[] }[]
      | null,
  );
  const league = firstRelation(division?.league);
  return league?.season_id === season.id;
}

export async function activeSeasonTeamIds(
  supabase: SupabaseClient,
  groupId?: string | null,
): Promise<Set<string>> {
  const groupIds = groupId
    ? [groupId]
    : await activeSeasonGroupIds(supabase);

  if (groupIds.length === 0) return new Set();

  const { data: teams, error: teamError } = await selectAllRows<{ id: string }>(
    (from, to) =>
      supabase
        .from("teams")
        .select("id")
        .in("group_id", groupIds)
        .order("id")
        .range(from, to),
  );
  if (teamError) throw teamError;

  return new Set(teams.map((t) => t.id));
}

export async function activeSeasonMatchIds(
  supabase: SupabaseClient,
  groupId?: string | null,
): Promise<Set<string>> {
  const groupIds = groupId
    ? [groupId]
    : await activeSeasonGroupIds(supabase);

  if (groupIds.length === 0) return new Set();

  const { data: matches, error: matchError } = await selectAllRows<{
    id: string;
  }>((from, to) =>
    supabase
      .from("matches")
      .select("id")
      .in("group_id", groupIds)
      .order("id")
      .range(from, to),
  );
  if (matchError) throw matchError;

  return new Set(matches.map((m) => m.id));
}
