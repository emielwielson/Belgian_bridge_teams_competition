import type { SupabaseClient } from "@supabase/supabase-js";
import { groupIdsForSeason } from "@/lib/competition/admin-season-scope";
import { getActiveSeason } from "@/lib/competition/season";

export type PlayerTeamAppearance = {
  team_id: string;
  team_name: string;
  matches_played: number;
  matches_as_sub: number;
};

export type PlayerDetail = {
  player: { id: string; name: string; member_number: string | null };
  assigned_team: { id: string; name: string } | null;
  appearances: PlayerTeamAppearance[];
};

function unwrapOne<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

type AppearanceRow = {
  team_id: string;
  is_substitute: boolean;
  match: {
    played_at: string | null;
    group_id: string;
  } | null;
};

export function aggregatePlayerAppearances(
  rows: AppearanceRow[],
  activeGroupIds: ReadonlySet<string> | null,
): Map<string, { matches_played: number; matches_as_sub: number }> {
  const counts = new Map<string, { matches_played: number; matches_as_sub: number }>();

  for (const row of rows) {
    const match = row.match;
    if (!match?.played_at) continue;

    if (activeGroupIds && !activeGroupIds.has(match.group_id)) continue;

    const entry = counts.get(row.team_id) ?? { matches_played: 0, matches_as_sub: 0 };
    entry.matches_played += 1;
    if (row.is_substitute) entry.matches_as_sub += 1;
    counts.set(row.team_id, entry);
  }

  return counts;
}

export async function loadPlayerDetail(
  supabase: SupabaseClient,
  playerId: string,
): Promise<PlayerDetail | null> {
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, name, member_number")
    .eq("id", playerId)
    .maybeSingle();

  if (playerError) throw playerError;
  if (!player) return null;

  const season = await getActiveSeason(supabase);

  let assignedTeam: { id: string; name: string } | null = null;
  let activeGroupIds: Set<string> | null = null;

  if (season) {
    const { data: assignment, error: assignmentError } = await supabase
      .from("team_players")
      .select("team:teams(id, name)")
      .eq("player_id", playerId)
      .eq("season_id", season.id)
      .maybeSingle();

    if (assignmentError) throw assignmentError;
    assignedTeam = unwrapOne<{ id: string; name: string }>(assignment?.team);

    const groupIds = await groupIdsForSeason(supabase, season.id);
    activeGroupIds = new Set(groupIds);
  }

  const { data: appearanceRows, error: appearancesError } = await supabase
    .from("match_players")
    .select(
      `
      team_id,
      is_substitute,
      match:matches!inner (
        played_at,
        group_id
      )
    `,
    )
    .eq("player_id", playerId);

  if (appearancesError) throw appearancesError;

  const counts = aggregatePlayerAppearances(
    (appearanceRows ?? []) as unknown as AppearanceRow[],
    activeGroupIds,
  );

  const teamIds = [...counts.keys()];
  const teamNames = new Map<string, string>();

  if (teamIds.length > 0) {
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", teamIds);

    if (teamsError) throw teamsError;
    for (const team of teams ?? []) {
      teamNames.set(team.id, team.name);
    }
  }

  const appearances: PlayerTeamAppearance[] = teamIds
    .map((teamId) => {
      const entry = counts.get(teamId)!;
      return {
        team_id: teamId,
        team_name: teamNames.get(teamId) ?? "Team",
        matches_played: entry.matches_played,
        matches_as_sub: entry.matches_as_sub,
      };
    })
    .sort((a, b) => a.team_name.localeCompare(b.team_name));

  return {
    player: {
      id: player.id,
      name: player.name,
      member_number: player.member_number,
    },
    assigned_team: assignedTeam,
    appearances,
  };
}
