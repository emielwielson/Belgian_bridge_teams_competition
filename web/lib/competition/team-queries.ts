import type { SupabaseClient } from "@supabase/supabase-js";
import { getActivePlayerId } from "@/lib/auth/active-player";
import { getActiveSeason } from "@/lib/competition/season";
import { teamLocationFromClub } from "@/lib/competition/team-location";
import { matchStatus, type MatchStatus } from "@/lib/scoring/match-state";
import type { PostgrestError } from "@supabase/supabase-js";

export type TeamRosterPlayer = {
  id: string;
  name: string;
  member_number: string | null;
  matches_played: number;
};

export type TeamMatchRow = {
  id: string;
  round: number;
  datetime: string;
  isHome: boolean;
  opponent: { id: string; name: string };
  status: MatchStatus;
  teamVp: number | null;
  opponentVp: number | null;
};

export type TeamDetail = {
  team: {
    id: string;
    name: string;
    location: string | null;
    captain_id: string | null;
  };
  captain: TeamRosterPlayer | null;
  club: { id: string; name: string };
  group: { id: string; name: string };
  division: { id: string; name: string };
  league: { id: string; name: string };
  roster: TeamRosterPlayer[];
  matches: TeamMatchRow[];
};

type RawMatch = {
  id: string;
  round: number;
  datetime: string;
  home_team_id: string;
  away_team_id: string;
  hosting_team_id: string | null;
  vp_home: number | null;
  vp_away: number | null;
  played_at: string | null;
};

function isMissingHostingTeamIdColumn(error: PostgrestError | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" &&
    typeof error.message === "string" &&
    error.message.includes("hosting_team_id")
  );
}

function unwrapOne<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

/** Lineup appearances in played matches for this team (includes substitutes). */
export async function loadTeamPlayerMatchesPlayed(
  supabase: SupabaseClient,
  teamId: string,
  playedMatchIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (playedMatchIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("match_players")
    .select("player_id")
    .eq("team_id", teamId)
    .in("match_id", [...playedMatchIds]);

  if (error) throw error;

  for (const row of data ?? []) {
    counts.set(row.player_id, (counts.get(row.player_id) ?? 0) + 1);
  }
  return counts;
}

export function withMatchesPlayed(
  roster: Omit<TeamRosterPlayer, "matches_played">[],
  counts: Map<string, number>,
): TeamRosterPlayer[] {
  return roster.map((player) => ({
    ...player,
    matches_played: counts.get(player.id) ?? 0,
  }));
}

export function mapRawMatchToTeamMatchRow(
  match: RawMatch,
  teamId: string,
  teamNames: Map<string, string>,
): TeamMatchRow {
  const isScoringHome = match.home_team_id === teamId;
  const isHome = (match.hosting_team_id ?? match.home_team_id) === teamId;
  const opponentId = isScoringHome ? match.away_team_id : match.home_team_id;
  return {
    id: match.id,
    round: match.round,
    datetime: match.datetime,
    isHome,
    opponent: {
      id: opponentId,
      name: teamNames.get(opponentId) ?? "Opponent",
    },
    status: matchStatus(match.played_at),
    teamVp: isScoringHome ? match.vp_home : match.vp_away,
    opponentVp: isScoringHome ? match.vp_away : match.vp_home,
  };
}

export async function loadTeamDetail(
  supabase: SupabaseClient,
  teamId: string,
): Promise<TeamDetail | null> {
  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select(
      `
      id,
      name,
      captain_id,
      captain:players(id, name, member_number),
      club:clubs(id, name, location),
      group:groups (
        id,
        name,
        division:divisions (
          id,
          name,
          league:leagues (
            id,
            name
          )
        )
      )
    `,
    )
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) throw teamError;
  if (!teamRow) return null;

  const group = unwrapOne<{ id: string; name: string; division: unknown }>(
    teamRow.group,
  );
  if (!group) return null;

  const division = unwrapOne<{ id: string; name: string; league: unknown }>(
    group.division,
  );
  if (!division) return null;

  const league = unwrapOne<{ id: string; name: string }>(division.league);
  if (!league) return null;

  const captainRaw = unwrapOne<{
    id: string;
    name: string;
    member_number: string | null;
  }>(teamRow.captain);
  const club = unwrapOne<{ id: string; name: string; location: string | null }>(
    teamRow.club,
  );
  if (!club) return null;

  const season = await getActiveSeason(supabase);
  let rosterPlayers: Omit<TeamRosterPlayer, "matches_played">[] = [];

  if (season) {
    const { data: rosterRows, error: rosterError } = await supabase
      .from("team_players")
      .select("player:players(id, name, member_number)")
      .eq("team_id", teamId)
      .eq("season_id", season.id);

    if (rosterError) throw rosterError;

    rosterPlayers = (rosterRows ?? [])
      .map((row) =>
        unwrapOne<{
          id: string;
          name: string;
          member_number: string | null;
        }>(row.player),
      )
      .filter((p): p is Omit<TeamRosterPlayer, "matches_played"> => p != null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  let { data: matchRows, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, round, datetime, home_team_id, away_team_id, hosting_team_id, vp_home, vp_away, played_at",
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("round")
    .order("datetime");

  if (isMissingHostingTeamIdColumn(matchesError)) {
    const fallback = await supabase
      .from("matches")
      .select("id, round, datetime, home_team_id, away_team_id, vp_home, vp_away, played_at")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order("round")
      .order("datetime");
    matchRows =
      fallback.data?.map((m) => ({ ...m, hosting_team_id: null })) ?? null;
    matchesError = fallback.error;
  }

  if (matchesError) throw matchesError;

  const rawMatches = (matchRows ?? []) as RawMatch[];
  const opponentIds = new Set<string>();
  for (const m of rawMatches) {
    opponentIds.add(
      m.home_team_id === teamId ? m.away_team_id : m.home_team_id,
    );
  }

  const teamNames = new Map<string, string>([[teamId, teamRow.name]]);
  if (opponentIds.size > 0) {
    const { data: opponents, error: opponentsError } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", [...opponentIds]);

    if (opponentsError) throw opponentsError;
    for (const t of opponents ?? []) {
      teamNames.set(t.id, t.name);
    }
  }

  const matches = rawMatches.map((m) =>
    mapRawMatchToTeamMatchRow(m, teamId, teamNames),
  );

  const playedMatchIds = rawMatches
    .filter((m) => m.played_at != null)
    .map((m) => m.id);
  const matchesPlayedByPlayer = await loadTeamPlayerMatchesPlayed(
    supabase,
    teamId,
    playedMatchIds,
  );
  const roster = withMatchesPlayed(rosterPlayers, matchesPlayedByPlayer);

  return {
    team: {
      id: teamRow.id,
      name: teamRow.name,
      location: teamLocationFromClub(club),
      captain_id: teamRow.captain_id,
    },
    captain: captainRaw
      ? {
          ...captainRaw,
          matches_played: matchesPlayedByPlayer.get(captainRaw.id) ?? 0,
        }
      : null,
    club,
    group: { id: group.id, name: group.name },
    division: { id: division.id, name: division.name },
    league,
    roster,
    matches,
  };
}

export type PlayerTeamSummary = {
  id: string;
  name: string;
};

/** Teams the linked player belongs to in the active season (at most one per season rules). */
export async function loadTeamsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlayerTeamSummary[]> {
  const playerId = await getActivePlayerId(supabase, userId);
  if (!playerId) return [];

  const season = await getActiveSeason(supabase);
  if (!season) return [];

  const { data: rows, error } = await supabase
    .from("team_players")
    .select("team:teams(id, name)")
    .eq("player_id", playerId)
    .eq("season_id", season.id);

  if (error) throw error;

  const teams: PlayerTeamSummary[] = [];
  for (const row of rows ?? []) {
    const team = unwrapOne<{ id: string; name: string }>(row.team);
    if (team) teams.push({ id: team.id, name: team.name });
  }

  return teams.sort((a, b) => a.name.localeCompare(b.name));
}
