import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AuthError,
  COMPETITION_ADMIN_ROLES,
} from "./route-auth";
import { hasAnyRole } from "./roles";
import { getManagedClubIds } from "./user-access";

export type MatchContext = {
  id: string;
  group_id: string;
  round: number;
  datetime: string;
  home_team_id: string;
  away_team_id: string;
  board_count: number;
  imps_home: number | null;
  imps_away: number | null;
  vp_home: number | null;
  vp_away: number | null;
  played_at: string | null;
  home_team: { id: string; name: string; club_id: string };
  away_team: { id: string; name: string; club_id: string };
};

export async function loadMatchContext(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchContext> {
  const { data: match, error } = await supabase
    .from("matches")
    .select(
      "id, group_id, round, datetime, home_team_id, away_team_id, board_count, imps_home, imps_away, vp_home, vp_away, played_at",
    )
    .eq("id", matchId)
    .maybeSingle();

  if (error) throw error;
  if (!match) throw new AuthError("Match not found", 403);

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, club_id")
    .in("id", [match.home_team_id, match.away_team_id]);

  if (teamsError) throw teamsError;

  const home = teams?.find((t) => t.id === match.home_team_id);
  const away = teams?.find((t) => t.id === match.away_team_id);
  if (!home || !away) throw new AuthError("Match teams not found", 403);

  return {
    id: match.id,
    group_id: match.group_id,
    round: match.round,
    datetime: match.datetime,
    home_team_id: match.home_team_id,
    away_team_id: match.away_team_id,
    board_count: match.board_count,
    imps_home: match.imps_home,
    imps_away: match.imps_away,
    vp_home: match.vp_home,
    vp_away: match.vp_away,
    played_at: match.played_at,
    home_team: home,
    away_team: away,
  };
}

async function rpcBool(
  supabase: SupabaseClient,
  fn: string,
  matchId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(fn, { p_match_id: matchId });
  if (error) throw error;
  return Boolean(data);
}

export async function canEditLineup(
  supabase: SupabaseClient,
  matchId: string,
): Promise<boolean> {
  return rpcBool(supabase, "current_user_can_edit_lineup", matchId);
}

export async function canSubmitScore(
  supabase: SupabaseClient,
  matchId: string,
): Promise<boolean> {
  return rpcBool(supabase, "current_user_can_submit_score", matchId);
}

export async function canViewMatchOps(
  supabase: SupabaseClient,
  matchId: string,
): Promise<boolean> {
  return rpcBool(supabase, "current_user_can_view_match_ops", matchId);
}

export async function assertCanViewMatchOps(
  supabase: SupabaseClient,
  matchId: string,
): Promise<void> {
  if (!(await canViewMatchOps(supabase, matchId))) {
    throw new AuthError("Forbidden: cannot access this match", 403);
  }
}

export async function assertCanEditLineup(
  supabase: SupabaseClient,
  match: MatchContext,
): Promise<void> {
  if (match.played_at) {
    throw new AuthError("Cannot edit lineup after match is played", 403);
  }
  if (!(await canEditLineup(supabase, match.id))) {
    throw new AuthError("Forbidden: cannot edit lineup for this match", 403);
  }
}

export async function assertCanSubmitScore(
  supabase: SupabaseClient,
  match: MatchContext,
): Promise<void> {
  if (match.played_at) {
    throw new AuthError("Match already scored; use admin edit", 403);
  }
  if (!(await canSubmitScore(supabase, match.id))) {
    throw new AuthError("Forbidden: cannot submit score for this match", 403);
  }
}

export function assertCanAdminEditScore(roles: string[]): void {
  if (!hasAnyRole(roles, [...COMPETITION_ADMIN_ROLES])) {
    throw new AuthError(
      "Forbidden: only competition managers can edit official scores",
      403,
    );
  }
}

export async function isUserOnMatchTeam(
  supabase: SupabaseClient,
  userId: string,
  match: MatchContext,
): Promise<boolean> {
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!player) return false;

  const { data: roster } = await supabase
    .from("team_players")
    .select("team_id")
    .eq("player_id", player.id)
    .in("team_id", [match.home_team_id, match.away_team_id]);

  return (roster?.length ?? 0) > 0;
}

export async function userManagesMatchClub(
  supabase: SupabaseClient,
  userId: string,
  roles: string[],
  match: MatchContext,
): Promise<boolean> {
  if (hasAnyRole(roles, [...COMPETITION_ADMIN_ROLES])) return true;
  const clubIds = await getManagedClubIds(supabase, userId);
  return (
    clubIds.includes(match.home_team.club_id) ||
    clubIds.includes(match.away_team.club_id)
  );
}
