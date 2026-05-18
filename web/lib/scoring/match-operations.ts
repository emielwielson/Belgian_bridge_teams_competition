import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchContext } from "@/lib/auth/match-access";
import { lookupVpForMatch } from "./vp-lookup";

export type LineupPlayerInput = {
  player_id: string;
  is_substitute: boolean;
};

export type MatchLineupEntry = {
  id: string;
  team_id: string;
  player_id: string;
  is_substitute: boolean;
  player: { id: string; name: string; member_number: string | null };
};

const MIN_PLAYERS_PER_TEAM = 4;

export class LineupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LineupValidationError";
  }
}

export async function validateLineupPayload(
  supabase: SupabaseClient,
  teamId: string,
  clubId: string,
  seasonId: string,
  players: LineupPlayerInput[],
): Promise<void> {
  if (players.length < MIN_PLAYERS_PER_TEAM) {
    throw new LineupValidationError(
      `At least ${MIN_PLAYERS_PER_TEAM} players are required`,
    );
  }

  const playerIds = players.map((p) => p.player_id);
  if (new Set(playerIds).size !== playerIds.length) {
    throw new LineupValidationError("Duplicate players in lineup");
  }

  const { data: rosterRows, error: rosterError } = await supabase
    .from("team_players")
    .select("player_id")
    .eq("team_id", teamId)
    .eq("season_id", seasonId);

  if (rosterError) throw rosterError;

  const rosterIds = new Set(rosterRows?.map((r) => r.player_id) ?? []);

  for (const entry of players) {
    if (!entry.is_substitute) {
      if (!rosterIds.has(entry.player_id)) {
        throw new LineupValidationError(
          "Lineup players must be on the team roster",
        );
      }
    } else if (rosterIds.has(entry.player_id)) {
      throw new LineupValidationError(
        "Substitute must be a club member not on the team roster",
      );
    }
  }

  const subIds = players
    .filter((p) => p.is_substitute)
    .map((p) => p.player_id);

  if (subIds.length === 0) return;

  const { data: memberships, error: memberError } = await supabase
    .from("player_club_memberships")
    .select("player_id")
    .eq("club_id", clubId)
    .eq("season_id", seasonId)
    .in("player_id", subIds);

  if (memberError) throw memberError;

  const memberIds = new Set(memberships?.map((m) => m.player_id) ?? []);
  for (const id of subIds) {
    if (!memberIds.has(id)) {
      throw new LineupValidationError(
        "Substitute must be a member of the team's club",
      );
    }
  }
}

export async function getMatchLineup(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchLineupEntry[]> {
  const { data, error } = await supabase
    .from("match_players")
    .select(
      "id, team_id, player_id, is_substitute, player:players(id, name, member_number)",
    )
    .eq("match_id", matchId);

  if (error) throw error;
  return (data ?? []) as MatchLineupEntry[];
}

export async function countLineupByTeam(
  supabase: SupabaseClient,
  matchId: string,
): Promise<Map<string, number>> {
  const lineup = await getMatchLineup(supabase, matchId);
  const counts = new Map<string, number>();
  for (const row of lineup) {
    counts.set(row.team_id, (counts.get(row.team_id) ?? 0) + 1);
  }
  return counts;
}

export async function isLineupComplete(
  supabase: SupabaseClient,
  match: Pick<MatchContext, "id" | "home_team_id" | "away_team_id">,
): Promise<boolean> {
  const counts = await countLineupByTeam(supabase, match.id);
  return (
    (counts.get(match.home_team_id) ?? 0) >= MIN_PLAYERS_PER_TEAM &&
    (counts.get(match.away_team_id) ?? 0) >= MIN_PLAYERS_PER_TEAM
  );
}

export async function assertLineupComplete(
  supabase: SupabaseClient,
  match: MatchContext,
): Promise<void> {
  const counts = await countLineupByTeam(supabase, match.id);
  for (const teamId of [match.home_team_id, match.away_team_id]) {
    const count = counts.get(teamId) ?? 0;
    if (count < MIN_PLAYERS_PER_TEAM) {
      const name =
        teamId === match.home_team_id
          ? match.home_team.name
          : match.away_team.name;
      throw new Error(
        `${name} must have at least ${MIN_PLAYERS_PER_TEAM} players registered (has ${count})`,
      );
    }
  }
}

export async function replaceMatchLineup(
  supabase: SupabaseClient,
  matchId: string,
  teamId: string,
  players: LineupPlayerInput[],
): Promise<MatchLineupEntry[]> {
  const { error: deleteError } = await supabase
    .from("match_players")
    .delete()
    .eq("match_id", matchId)
    .eq("team_id", teamId);

  if (deleteError) throw deleteError;

  if (players.length === 0) {
    return getMatchLineup(supabase, matchId);
  }

  const { error: insertError } = await supabase.from("match_players").insert(
    players.map((p) => ({
      match_id: matchId,
      team_id: teamId,
      player_id: p.player_id,
      is_substitute: p.is_substitute,
    })),
  );

  if (insertError) throw insertError;
  return getMatchLineup(supabase, matchId);
}

export type ScorePayload = {
  impsHome: number;
  impsAway: number;
};

export type SubmittedMatchScore = {
  id: string;
  imps_home: number;
  imps_away: number;
  vp_home: number;
  vp_away: number;
  played_at: string | null;
};

async function insertMatchLog(
  supabase: SupabaseClient,
  matchId: string,
  userId: string,
  action: string,
): Promise<void> {
  const { error } = await supabase.from("match_logs").insert({
    match_id: matchId,
    action,
    user_id: userId,
  });
  if (error) throw error;
}

export async function submitMatchScore(
  supabase: SupabaseClient,
  match: MatchContext,
  userId: string,
  payload: ScorePayload,
  options: { isAdminEdit: boolean; previous?: ScorePayload & { vpHome: number; vpAway: number } },
): Promise<SubmittedMatchScore> {
  const { impsHome, impsAway } = payload;
  const { vpHome, vpAway } = await lookupVpForMatch(
    supabase,
    match.id,
    impsHome,
    impsAway,
  );

  if (!options.isAdminEdit) {
    await assertLineupComplete(supabase, match);
  }

  const { data, error } = await supabase
    .from("matches")
    .update({
      imps_home: impsHome,
      imps_away: impsAway,
      vp_home: vpHome,
      vp_away: vpAway,
    })
    .eq("id", match.id)
    .select("id, imps_home, imps_away, vp_home, vp_away, played_at")
    .single();

  if (error) throw error;

  const logPayload = {
    imps_home: impsHome,
    imps_away: impsAway,
    vp_home: vpHome,
    vp_away: vpAway,
    ...(options.previous
      ? {
          previous: {
            imps_home: options.previous.impsHome,
            imps_away: options.previous.impsAway,
            vp_home: options.previous.vpHome,
            vp_away: options.previous.vpAway,
          },
        }
      : {}),
  };

  const action = options.isAdminEdit
    ? `score_admin_edit:${JSON.stringify(logPayload)}`
    : `score_submitted:${JSON.stringify(logPayload)}`;

  await insertMatchLog(supabase, match.id, userId, action);

  return data as SubmittedMatchScore;
}
