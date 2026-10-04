import type { SupabaseClient } from "@supabase/supabase-js";
import { getActivePlayerId } from "@/lib/auth/active-player";
import { leagueNameForCompetitionKind } from "@/lib/competition/league-names";
import { applyMatchDatesDivisionFilter } from "@/lib/competition/match-dates-query";
import { getActiveSeason } from "@/lib/competition/season";
import {
  resolveClubMatchLocation,
  resolveTeamMatchLocation,
} from "@/lib/competition/team-location";
import { matchStatus, type MatchStatus } from "@/lib/scoring/match-state";
import type { PostgrestError } from "@supabase/supabase-js";

export type TeamRosterPlayer = {
  id: string;
  name: string;
  member_number: string | null;
  matches_played: number;
};

export type TeamSubstituteAppearance = {
  id: string;
  name: string;
  member_number: string | null;
  matches_played: number;
};

export type TeamCaptain = TeamRosterPlayer & {
  email?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
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
  /** Unscored fixture moved off the official round datetime. */
  isRescheduled: boolean;
};

export type TeamDetail = {
  team: {
    id: string;
    name: string;
    /** Resolved display location (division → team → club). */
    location: string | null;
    /** Raw per-team override; null means use club location. */
    locationOverride: string | null;
    captain_id: string | null;
  };
  captain: TeamCaptain | null;
  club: { id: string; name: string };
  /** Club venue without team/division overrides (for the change-location modal). */
  clubLocation: string | null;
  hasCentralizedVenue: boolean;
  group: { id: string; name: string };
  division: { id: string; name: string };
  league: { id: string; name: string };
  roster: TeamRosterPlayer[];
  substitutes: TeamSubstituteAppearance[];
  matches: TeamMatchRow[];
};

export type LoadTeamDetailOptions = {
  includeCaptainContacts?: boolean;
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

/** Substitute appearances in played matches for this team. */
export async function loadTeamSubstituteAppearances(
  supabase: SupabaseClient,
  teamId: string,
  playedMatchIds: readonly string[],
): Promise<TeamSubstituteAppearance[]> {
  if (playedMatchIds.length === 0) return [];

  const { data, error } = await supabase
    .from("match_players")
    .select("player_id, player:players(id, name, member_number)")
    .eq("team_id", teamId)
    .eq("is_substitute", true)
    .in("match_id", [...playedMatchIds]);

  if (error) throw error;

  const byPlayer = new Map<
    string,
    { name: string; member_number: string | null; matches_played: number }
  >();

  for (const row of data ?? []) {
    const player = unwrapOne<{
      id: string;
      name: string;
      member_number: string | null;
    }>(row.player);
    if (!player) continue;

    const existing = byPlayer.get(player.id);
    if (existing) {
      existing.matches_played += 1;
    } else {
      byPlayer.set(player.id, {
        name: player.name,
        member_number: player.member_number,
        matches_played: 1,
      });
    }
  }

  return [...byPlayer.entries()]
    .map(([id, entry]) => ({
      id,
      name: entry.name,
      member_number: entry.member_number,
      matches_played: entry.matches_played,
    }))
    .sort((a, b) => {
      if (b.matches_played !== a.matches_played) {
        return b.matches_played - a.matches_played;
      }
      return a.name.localeCompare(b.name);
    });
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

export function datetimesEqual(a: string, b: string): boolean {
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return a === b;
  return aMs === bMs;
}

/** True when an unscored match left its official competition_match_dates slot. */
export function isMatchRescheduled(
  matchDatetime: string,
  officialDatetime: string | undefined,
  playedAt: string | null,
): boolean {
  if (playedAt != null) return false;
  if (!officialDatetime) return false;
  return !datetimesEqual(matchDatetime, officialDatetime);
}

async function loadOfficialRoundDatetimes(
  supabase: SupabaseClient,
  groupId: string,
  league: { season_id: string; scope: string; region_id: string | null },
): Promise<Map<number, string>> {
  const { data: datesDivisionId, error: resolveError } = await supabase.rpc(
    "resolve_group_match_dates_division_id",
    { p_group_id: groupId },
  );
  if (resolveError) throw new Error(resolveError.message);

  let datesQuery = supabase
    .from("competition_match_dates")
    .select("round, datetime")
    .eq("season_id", league.season_id)
    .eq("scope", league.scope)
    .order("round");

  datesQuery =
    league.scope === "national"
      ? datesQuery.is("region_id", null)
      : datesQuery.eq("region_id", league.region_id!);

  datesQuery = applyMatchDatesDivisionFilter(datesQuery, datesDivisionId);

  const { data: dates, error: datesError } = await datesQuery;
  if (datesError) throw new Error(datesError.message);

  return new Map(
    (dates ?? []).map((d) => [d.round as number, d.datetime as string]),
  );
}

export function mapRawMatchToTeamMatchRow(
  match: RawMatch,
  teamId: string,
  teamNames: Map<string, string>,
  officialDatetimeByRound: ReadonlyMap<number, string> = new Map(),
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
    isRescheduled: isMatchRescheduled(
      match.datetime,
      officialDatetimeByRound.get(match.round),
      match.played_at,
    ),
  };
}

export async function loadTeamDetail(
  supabase: SupabaseClient,
  teamId: string,
  options: LoadTeamDetailOptions = {},
): Promise<TeamDetail | null> {
  const includeCaptainContacts = options.includeCaptainContacts === true;
  const captainSelect = includeCaptainContacts
    ? "captain:players(id, name, member_number, email, phone, mobile_phone)"
    : "captain:players(id, name, member_number)";

  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select(
      `
      id,
      name,
      location,
      captain_id,
      ${captainSelect},
      club:clubs(id, name, address, postal_code, location, competition_location),
      group:groups (
        id,
        name,
        division:divisions (
          id,
          name,
          centralized_location,
          league:leagues (
            id,
            name,
            season_id,
            scope,
            region_id
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

  const division = unwrapOne<{
    id: string;
    name: string;
    centralized_location: string | null;
    league: unknown;
  }>(group.division);
  if (!division) return null;

  const league = unwrapOne<{
    id: string;
    name: string;
    season_id: string;
    scope: string;
    region_id: string | null;
  }>(division.league);
  if (!league) return null;

  const captainRaw = unwrapOne<{
    id: string;
    name: string;
    member_number: string | null;
    email?: string | null;
    phone?: string | null;
    mobile_phone?: string | null;
  }>(teamRow.captain);
  const club = unwrapOne<{
    id: string;
    name: string;
    address: string | null;
    postal_code: string | null;
    location: string | null;
    competition_location: string | null;
  }>(teamRow.club);
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
    .order("datetime")
    .order("round");

  if (isMissingHostingTeamIdColumn(matchesError)) {
    const fallback = await supabase
      .from("matches")
      .select("id, round, datetime, home_team_id, away_team_id, vp_home, vp_away, played_at")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order("datetime")
      .order("round");
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
  const [opponentsResult, officialDatetimeByRound] = await Promise.all([
    opponentIds.size > 0
      ? supabase.from("teams").select("id, name").in("id", [...opponentIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    loadOfficialRoundDatetimes(supabase, group.id, league),
  ]);

  if (opponentsResult.error) throw opponentsResult.error;
  for (const t of opponentsResult.data ?? []) {
    teamNames.set(t.id, t.name);
  }

  const matches = rawMatches.map((m) =>
    mapRawMatchToTeamMatchRow(m, teamId, teamNames, officialDatetimeByRound),
  );

  const playedMatchIds = rawMatches
    .filter((m) => m.played_at != null)
    .map((m) => m.id);
  const [matchesPlayedByPlayer, substitutes] = await Promise.all([
    loadTeamPlayerMatchesPlayed(supabase, teamId, playedMatchIds),
    loadTeamSubstituteAppearances(supabase, teamId, playedMatchIds),
  ]);
  const roster = withMatchesPlayed(rosterPlayers, matchesPlayedByPlayer);

  const locationOverride =
    typeof teamRow.location === "string" && teamRow.location.trim()
      ? teamRow.location.trim()
      : null;
  const hasCentralizedVenue = Boolean(
    typeof division.centralized_location === "string" &&
      division.centralized_location.trim(),
  );

  return {
    team: {
      id: teamRow.id,
      name: teamRow.name,
      location: resolveTeamMatchLocation(club, division, {
        location: locationOverride,
      }),
      locationOverride,
      captain_id: teamRow.captain_id,
    },
    captain: captainRaw
      ? {
          id: captainRaw.id,
          name: captainRaw.name,
          member_number: captainRaw.member_number,
          matches_played: matchesPlayedByPlayer.get(captainRaw.id) ?? 0,
          ...(includeCaptainContacts
            ? {
                email: captainRaw.email ?? null,
                phone: captainRaw.phone ?? null,
                mobile_phone: captainRaw.mobile_phone ?? null,
              }
            : {}),
        }
      : null,
    club: { id: club.id, name: club.name },
    clubLocation: resolveClubMatchLocation(club),
    hasCentralizedVenue,
    group: { id: group.id, name: group.name },
    division: { id: division.id, name: division.name },
    league: { id: league.id, name: league.name },
    roster,
    substitutes,
    matches,
  };
}

export type PlayerTeamSummary = {
  id: string;
  name: string;
  competitionKindCode: string | null;
  competitionName: string | null;
};

const TEAM_SUMMARY_KIND_SELECT =
  "group:groups(division:divisions(league:leagues(competition_kind:competition_kinds(code))))";

const TEAM_SUMMARY_KIND_SELECT_INNER =
  "group:groups!inner(division:divisions!inner(league:leagues!inner(season_id, competition_kind:competition_kinds(code))))";

function playerTeamSummaryFromTeamRow(
  team: { id: string; name: string; group?: unknown } | null,
): PlayerTeamSummary | null {
  if (!team) return null;

  const group = unwrapOne(team.group);
  const division = unwrapOne(
    group && typeof group === "object"
      ? (group as { division?: unknown }).division
      : null,
  );
  const league = unwrapOne(
    division && typeof division === "object"
      ? (division as { league?: unknown }).league
      : null,
  );
  const kind = unwrapOne(
    league && typeof league === "object"
      ? (league as { competition_kind?: unknown }).competition_kind
      : null,
  );
  const competitionKindCode =
    kind && typeof kind === "object" && typeof (kind as { code?: unknown }).code === "string"
      ? ((kind as { code: string }).code)
      : null;

  return {
    id: team.id,
    name: team.name,
    competitionKindCode,
    competitionName: leagueNameForCompetitionKind(competitionKindCode),
  };
}

/** Teams the linked player is on (roster) or captains in the active season. */
export async function loadTeamsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlayerTeamSummary[]> {
  const playerId = await getActivePlayerId(supabase, userId);
  if (!playerId) return [];

  const season = await getActiveSeason(supabase);
  if (!season) return [];

  const [rosterResult, captainResult] = await Promise.all([
    supabase
      .from("team_players")
      .select(`team:teams(id, name, ${TEAM_SUMMARY_KIND_SELECT})`)
      .eq("player_id", playerId)
      .eq("season_id", season.id),
    supabase
      .from("teams")
      .select(`id, name, ${TEAM_SUMMARY_KIND_SELECT_INNER}`)
      .eq("captain_id", playerId)
      .eq("group.division.league.season_id", season.id),
  ]);

  if (rosterResult.error) throw rosterResult.error;
  if (captainResult.error) throw captainResult.error;

  const byId = new Map<string, PlayerTeamSummary>();

  for (const row of rosterResult.data ?? []) {
    const summary = playerTeamSummaryFromTeamRow(
      unwrapOne<{ id: string; name: string; group?: unknown }>(row.team),
    );
    if (summary) byId.set(summary.id, summary);
  }

  for (const row of captainResult.data ?? []) {
    const summary = playerTeamSummaryFromTeamRow(row);
    if (summary) byId.set(summary.id, summary);
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
