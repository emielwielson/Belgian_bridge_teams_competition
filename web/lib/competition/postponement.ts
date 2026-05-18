import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingPostponement = {
  id: string;
  proposed_datetime: string;
  proposing_team_id: string;
  proposed_by: string | null;
  created_at: string;
};

export type MatchPostponementState = {
  match_id: string;
  datetime: string;
  played_at: string | null;
  home_team_id: string;
  away_team_id: string;
  captain_teams: string[];
  can_propose: boolean;
  can_approve: boolean;
  can_reject: boolean;
  can_cancel: boolean;
  pending: PendingPostponement | null;
};

function parseState(raw: unknown): MatchPostponementState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const captainTeams = Array.isArray(o.captain_teams)
    ? (o.captain_teams as string[])
    : [];

  let pending: PendingPostponement | null = null;
  if (o.pending && typeof o.pending === "object") {
    const p = o.pending as Record<string, unknown>;
    pending = {
      id: String(p.id),
      proposed_datetime: String(p.proposed_datetime),
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
    captain_teams: captainTeams,
    can_propose: Boolean(o.can_propose),
    can_approve: Boolean(o.can_approve),
    can_reject: Boolean(o.can_reject),
    can_cancel: Boolean(o.can_cancel),
    pending,
  };
}

export async function getMatchPostponementState(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchPostponementState | null> {
  const { data, error } = await supabase.rpc("get_match_postponement_state", {
    p_match_id: matchId,
  });
  if (error) throw error;
  return parseState(data);
}

export async function proposeMatchPostponement(
  supabase: SupabaseClient,
  matchId: string,
  proposedDatetime: string,
  proposingTeamId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("propose_match_postponement", {
    p_match_id: matchId,
    p_proposed_datetime: proposedDatetime,
    p_proposing_team_id: proposingTeamId,
  });
  if (error) throw error;
  return String(data);
}

export async function respondMatchPostponement(
  supabase: SupabaseClient,
  requestId: string,
  action: "approve" | "reject" | "cancel",
): Promise<void> {
  const { error } = await supabase.rpc("respond_match_postponement", {
    p_request_id: requestId,
    p_action: action,
  });
  if (error) throw error;
}

export function canAccessPostponementWorkflow(
  state: MatchPostponementState | null,
): boolean {
  if (!state) return false;
  return (
    state.can_propose ||
    state.can_approve ||
    state.can_reject ||
    state.can_cancel ||
    state.pending != null
  );
}
