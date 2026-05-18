import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingHomeAwaySwitch = {
  id: string;
  requesting_team_id: string;
  proposed_by: string | null;
  created_at: string;
};

export type FirstLegFixture = {
  home_team_id: string;
  away_team_id: string;
};

export type MatchHomeAwaySwitchState = {
  match_id: string;
  round: number;
  played_at: string | null;
  home_team_id: string;
  away_team_id: string;
  captain_teams: string[];
  needs_switch: boolean;
  is_mirror_round: boolean;
  first_leg_round: number | null;
  first_leg: FirstLegFixture | null;
  can_propose: boolean;
  can_approve: boolean;
  can_reject: boolean;
  can_cancel: boolean;
  pending: PendingHomeAwaySwitch | null;
};

function parseFirstLeg(raw: unknown): FirstLegFixture | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.home_team_id || !o.away_team_id) return null;
  return {
    home_team_id: String(o.home_team_id),
    away_team_id: String(o.away_team_id),
  };
}

function parseState(raw: unknown): MatchHomeAwaySwitchState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const captainTeams = Array.isArray(o.captain_teams)
    ? (o.captain_teams as string[])
    : [];

  let pending: PendingHomeAwaySwitch | null = null;
  if (o.pending && typeof o.pending === "object") {
    const p = o.pending as Record<string, unknown>;
    pending = {
      id: String(p.id),
      requesting_team_id: String(p.requesting_team_id),
      proposed_by: p.proposed_by != null ? String(p.proposed_by) : null,
      created_at: String(p.created_at),
    };
  }

  const firstLegRound =
    o.first_leg_round != null && o.first_leg_round !== null
      ? Number(o.first_leg_round)
      : null;

  return {
    match_id: String(o.match_id),
    round: Number(o.round),
    played_at: o.played_at != null ? String(o.played_at) : null,
    home_team_id: String(o.home_team_id),
    away_team_id: String(o.away_team_id),
    captain_teams: captainTeams,
    needs_switch: Boolean(o.needs_switch),
    is_mirror_round: Boolean(o.is_mirror_round),
    first_leg_round: Number.isFinite(firstLegRound) ? firstLegRound : null,
    first_leg: parseFirstLeg(o.first_leg),
    can_propose: Boolean(o.can_propose),
    can_approve: Boolean(o.can_approve),
    can_reject: Boolean(o.can_reject),
    can_cancel: Boolean(o.can_cancel),
    pending,
  };
}

export async function getMatchHomeAwaySwitchState(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchHomeAwaySwitchState | null> {
  const { data, error } = await supabase.rpc("get_match_home_away_switch_state", {
    p_match_id: matchId,
  });
  if (error) throw error;
  return parseState(data);
}

export async function proposeMatchHomeAwaySwitch(
  supabase: SupabaseClient,
  matchId: string,
  requestingTeamId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("propose_match_home_away_switch", {
    p_match_id: matchId,
    p_requesting_team_id: requestingTeamId,
  });
  if (error) throw error;
  return String(data);
}

export async function respondMatchHomeAwaySwitch(
  supabase: SupabaseClient,
  requestId: string,
  action: "approve" | "reject" | "cancel",
): Promise<void> {
  const { error } = await supabase.rpc("respond_match_home_away_switch", {
    p_request_id: requestId,
    p_action: action,
  });
  if (error) throw error;
}

/** Mirror-leg section on the match page (rounds 8–14, unscored). */
export function shouldShowHomeAwaySwitchSection(
  state: MatchHomeAwaySwitchState | null,
): boolean {
  if (!state) return false;
  return state.is_mirror_round && state.played_at == null;
}

/** Client/API may load switch state (not only when captain actions exist). */
export function canAccessHomeAwaySwitchWorkflow(
  state: MatchHomeAwaySwitchState | null,
): boolean {
  return shouldShowHomeAwaySwitchSection(state);
}

export function isHomeAwaySwitchCaptain(state: MatchHomeAwaySwitchState): boolean {
  return state.captain_teams.length > 0;
}
