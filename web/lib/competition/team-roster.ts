import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadCompetitionKindCodeForTeam,
  loadEligibleClubMembers,
} from "@/lib/competition/active-primary-membership";
import {
  rosterExclusivityPool,
  sameRosterExclusivityPool,
} from "@/lib/competition/roster-exclusivity";
import { TeamValidationError } from "@/lib/competition/team-captain";
import { loadTeamPlayerMatchesPlayed } from "@/lib/competition/team-queries";
import { getActiveSeason } from "@/lib/competition/season";

export type RosterPlayer = {
  player_id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  member_number: string | null;
  matches_played?: number;
};

export type TeamRosterState = {
  roster: RosterPlayer[];
  available_players: RosterPlayer[];
};

type PlayerNameRow = {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  member_number: string | null;
};

const PLAYER_SELECT =
  "player:players(id, name, first_name, last_name, member_number)";

const TEAM_KIND_SELECT =
  "group:groups(division:divisions(league:leagues(competition_kind:competition_kinds(code))))";

const ROSTER_POOL_CONFLICT_MESSAGE =
  "Player is already on another team this season in the same competition";

function unwrapOne<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

function competitionKindCodeFromTeamRow(team: unknown): string | null {
  const group = unwrapOne(
    team && typeof team === "object"
      ? (team as { group?: unknown }).group
      : null,
  );
  if (!group || typeof group !== "object") return null;
  const division = unwrapOne((group as { division?: unknown }).division);
  if (!division || typeof division !== "object") return null;
  const league = unwrapOne((division as { league?: unknown }).league);
  if (!league || typeof league !== "object") return null;
  const kind = unwrapOne(
    (league as { competition_kind?: unknown }).competition_kind,
  );
  if (!kind || typeof kind !== "object") return null;
  const code = (kind as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function namePart(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/** Sort by last_name, then first_name, then display name. */
export function comparePlayersByLastName(
  a: Pick<RosterPlayer, "name" | "first_name" | "last_name">,
  b: Pick<RosterPlayer, "name" | "first_name" | "last_name">,
): number {
  return (
    namePart(a.last_name).localeCompare(namePart(b.last_name)) ||
    namePart(a.first_name).localeCompare(namePart(b.first_name)) ||
    a.name.localeCompare(b.name)
  );
}

function toRosterPlayer(p: PlayerNameRow): RosterPlayer {
  return {
    player_id: p.id,
    name: p.name,
    first_name: p.first_name,
    last_name: p.last_name,
    member_number: p.member_number,
  };
}

function isRosterPoolConflictError(error: { message?: string } | null): boolean {
  return typeof error?.message === "string" &&
    error.message.includes("same competition");
}

export async function loadTeamRosterState(
  supabase: SupabaseClient,
  teamId: string,
  clubId: string,
): Promise<TeamRosterState> {
  const season = await getActiveSeason(supabase);
  let roster: RosterPlayer[] = [];
  let available_players: RosterPlayer[] = [];

  if (season) {
    const { data: rosterRows, error: rosterError } = await supabase
      .from("team_players")
      .select(`player_id, ${PLAYER_SELECT}`)
      .eq("team_id", teamId)
      .eq("season_id", season.id);

    if (rosterError) throw rosterError;

    roster = (rosterRows ?? [])
      .map((r) => {
        const p = unwrapOne<PlayerNameRow>(r.player);
        if (!p) return null;
        return toRosterPlayer(p);
      })
      .filter((p): p is RosterPlayer => p != null)
      .sort((a, b) => a.name.localeCompare(b.name));

    const competitionKindCode = await loadCompetitionKindCodeForTeam(
      supabase,
      teamId,
    );
    const targetPool = rosterExclusivityPool(competitionKindCode);
    const memberships = await loadEligibleClubMembers<{
      player: unknown;
    }>(supabase, clubId, `player_id, ${PLAYER_SELECT}`, competitionKindCode);

    const { data: clubTeams, error: clubTeamsError } = await supabase
      .from("teams")
      .select(`id, ${TEAM_KIND_SELECT}`)
      .eq("club_id", clubId);

    if (clubTeamsError) throw clubTeamsError;

    const samePoolClubTeamIds = (clubTeams ?? [])
      .filter((t) =>
        sameRosterExclusivityPool(
          competitionKindCode,
          competitionKindCodeFromTeamRow(t),
        ),
      )
      .map((t) => t.id);

    const assignedPlayerIds = new Set<string>();

    if (samePoolClubTeamIds.length > 0 && targetPool != null) {
      const { data: clubAssignments, error: assignmentsError } = await supabase
        .from("team_players")
        .select("player_id")
        .in("team_id", samePoolClubTeamIds)
        .eq("season_id", season.id);

      if (assignmentsError) throw assignmentsError;

      for (const row of clubAssignments ?? []) {
        assignedPlayerIds.add(row.player_id);
      }
    }

    const onRoster = new Set(roster.map((r) => r.player_id));

    for (const m of memberships) {
      const p = unwrapOne<PlayerNameRow>(m.player);
      if (!p || onRoster.has(p.id) || assignedPlayerIds.has(p.id)) continue;

      available_players.push(toRosterPlayer(p));
    }

    available_players.sort(comparePlayersByLastName);

    const { data: playedMatches, error: playedError } = await supabase
      .from("matches")
      .select("id")
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .not("played_at", "is", null);

    if (playedError) throw playedError;

    const matchesPlayedByPlayer = await loadTeamPlayerMatchesPlayed(
      supabase,
      teamId,
      (playedMatches ?? []).map((m) => m.id),
    );

    roster = roster.map((player) => ({
      ...player,
      matches_played: matchesPlayedByPlayer.get(player.player_id) ?? 0,
    }));
  }

  return { roster, available_players };
}

export async function addPlayerToTeamRoster(
  supabase: SupabaseClient,
  params: { teamId: string; playerId: string; seasonId: string },
): Promise<void> {
  const { error } = await supabase.from("team_players").insert({
    team_id: params.teamId,
    player_id: params.playerId,
    season_id: params.seasonId,
  });

  if (isRosterPoolConflictError(error)) {
    throw new TeamValidationError(ROSTER_POOL_CONFLICT_MESSAGE);
  }
  if (error) throw error;
}

export async function removePlayerFromTeamRoster(
  supabase: SupabaseClient,
  params: { teamId: string; playerId: string; seasonId: string },
): Promise<void> {
  const { error } = await supabase
    .from("team_players")
    .delete()
    .eq("team_id", params.teamId)
    .eq("player_id", params.playerId)
    .eq("season_id", params.seasonId);

  if (error) throw error;
}
