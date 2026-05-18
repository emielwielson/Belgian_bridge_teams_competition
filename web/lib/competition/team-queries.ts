import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveSeason } from "@/lib/competition/season";
import { matchStatus, type MatchStatus } from "@/lib/scoring/match-state";

export type TeamRosterPlayer = {
  id: string;
  name: string;
  member_number: string | null;
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
  vp_home: number | null;
  vp_away: number | null;
  played_at: string | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function mapRawMatchToTeamMatchRow(
  match: RawMatch,
  teamId: string,
  teamNames: Map<string, string>,
): TeamMatchRow {
  const isHome = match.home_team_id === teamId;
  const opponentId = isHome ? match.away_team_id : match.home_team_id;
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
    teamVp: isHome ? match.vp_home : match.vp_away,
    opponentVp: isHome ? match.vp_away : match.vp_home,
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
      location,
      captain_id,
      captain:players(id, name, member_number),
      club:clubs(id, name),
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

  const group = unwrapOne(teamRow.group as unknown);
  if (!group) return null;

  const division = unwrapOne(
    (group as { division: unknown }).division as { id: string; name: string; league: unknown },
  );
  if (!division) return null;

  const league = unwrapOne(division.league as { id: string; name: string });
  if (!league) return null;

  const captainRaw = unwrapOne(
    teamRow.captain as {
      id: string;
      name: string;
      member_number: string | null;
    } | null,
  );
  const club = unwrapOne(teamRow.club as { id: string; name: string });
  if (!club) return null;

  const season = await getActiveSeason(supabase);
  let roster: TeamRosterPlayer[] = [];

  if (season) {
    const { data: rosterRows, error: rosterError } = await supabase
      .from("team_players")
      .select("player:players(id, name, member_number)")
      .eq("team_id", teamId)
      .eq("season_id", season.id);

    if (rosterError) throw rosterError;

    roster = (rosterRows ?? [])
      .map((row) =>
        unwrapOne(
          row.player as {
            id: string;
            name: string;
            member_number: string | null;
          } | null,
        ),
      )
      .filter((p): p is TeamRosterPlayer => p != null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const { data: matchRows, error: matchesError } = await supabase
    .from("matches")
    .select(
      "id, round, datetime, home_team_id, away_team_id, vp_home, vp_away, played_at",
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order("round")
    .order("datetime");

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

  return {
    team: {
      id: teamRow.id,
      name: teamRow.name,
      location: teamRow.location,
      captain_id: teamRow.captain_id,
    },
    captain: captainRaw,
    club,
    group: { id: group.id, name: group.name },
    division: { id: division.id, name: division.name },
    league,
    roster,
    matches,
  };
}
