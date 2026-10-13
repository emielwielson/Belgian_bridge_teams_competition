import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingLocationChange = {
  id: string;
  proposed_location: string;
  proposing_team_id: string;
  proposed_by: string | null;
  created_at: string;
};

export type MatchLocationChangeState = {
  match_id: string;
  datetime: string;
  played_at: string | null;
  home_team_id: string;
  away_team_id: string;
  location_override: string | null;
  captain_teams: string[];
  can_propose: boolean;
  can_approve: boolean;
  can_reject: boolean;
  can_cancel: boolean;
  pending: PendingLocationChange | null;
};

function parseState(raw: unknown): MatchLocationChangeState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const captainTeams = Array.isArray(o.captain_teams)
    ? (o.captain_teams as string[])
    : [];

  let pending: PendingLocationChange | null = null;
  if (o.pending && typeof o.pending === "object") {
    const p = o.pending as Record<string, unknown>;
    pending = {
      id: String(p.id),
      proposed_location: String(p.proposed_location),
      proposing_team_id: String(p.proposing_team_id),
      proposed_by: p.proposed_by != null ? String(p.proposed_by) : null,
      created_at: String(p.created_at),
    };
  }

  return {
    match_id: String(o.match_id),
    datetime: String(o.datetime),
    played_at: o.played_at != null ? String(o.played_at) : null,
    home_team_id: String(o.home_team_id),
    away_team_id: String(o.away_team_id),
    location_override:
      o.location_override != null ? String(o.location_override) : null,
    captain_teams: captainTeams,
    can_propose: Boolean(o.can_propose),
    can_approve: Boolean(o.can_approve),
    can_reject: Boolean(o.can_reject),
    can_cancel: Boolean(o.can_cancel),
    pending,
  };
}

export async function getMatchLocationChangeState(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchLocationChangeState | null> {
  const { data, error } = await supabase.rpc("get_match_location_change_state", {
    p_match_id: matchId,
  });
  if (error) throw error;
  return parseState(data);
}

export async function proposeMatchLocationChange(
  supabase: SupabaseClient,
  matchId: string,
  proposedLocation: string,
  proposingTeamId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("propose_match_location_change", {
    p_match_id: matchId,
    p_proposed_location: proposedLocation,
    p_proposing_team_id: proposingTeamId,
  });
  if (error) throw error;
  return String(data);
}

export async function respondMatchLocationChange(
  supabase: SupabaseClient,
  requestId: string,
  action: "approve" | "reject" | "cancel",
): Promise<void> {
  const { error } = await supabase.rpc("respond_match_location_change", {
    p_request_id: requestId,
    p_action: action,
  });
  if (error) throw error;
}

export function canAccessLocationChangeWorkflow(
  state: MatchLocationChangeState | null,
): boolean {
  if (!state) return false;
  if (state.played_at != null) return false;
  return (
    state.can_propose ||
    state.can_approve ||
    state.can_reject ||
    state.can_cancel
  );
}

export function isLocationChangeCaptain(
  state: MatchLocationChangeState,
): boolean {
  return state.captain_teams.length > 0;
}

export function hasLocationChangeRespondActions(
  state: MatchLocationChangeState,
): boolean {
  return state.can_approve || state.can_reject || state.can_cancel;
}
