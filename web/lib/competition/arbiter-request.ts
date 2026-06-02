import type { SupabaseClient } from "@supabase/supabase-js";

export type ArbiterRequestRow = {
  id: string;
  board: number | null;
  description: string | null;
  image_path: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
};

export type MatchArbiterRequestsState = {
  match_id: string;
  can_submit: boolean;
  requests: ArbiterRequestRow[];
};

function parseState(raw: unknown): MatchArbiterRequestsState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const requestsRaw = Array.isArray(o.requests) ? o.requests : [];
  const requests: ArbiterRequestRow[] = requestsRaw
    .map((r) => {
      const row = r as Record<string, unknown>;
      const imagePath =
        row.image_path != null ? String(row.image_path).trim() : "";
      if (!imagePath) return null;
      const boardRaw = row.board;
      const descriptionRaw = row.description;
      return {
        id: String(row.id),
        board:
          boardRaw != null && boardRaw !== "" && Number.isFinite(Number(boardRaw))
            ? Number(boardRaw)
            : null,
        description:
          descriptionRaw != null && String(descriptionRaw).trim() !== ""
            ? String(descriptionRaw)
            : null,
        image_path: imagePath,
        status: String(row.status),
        created_at: String(row.created_at),
        resolved_at: row.resolved_at != null ? String(row.resolved_at) : null,
      };
    })
    .filter((r): r is ArbiterRequestRow => r != null);

  return {
    match_id: String(o.match_id),
    can_submit: Boolean(o.can_submit),
    requests,
  };
}

export async function getMatchArbiterRequestsState(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchArbiterRequestsState | null> {
  const { data, error } = await supabase.rpc("get_match_arbiter_requests_state", {
    p_match_id: matchId,
  });
  if (error) throw error;
  return parseState(data);
}

export function canAccessArbiterRequestWorkflow(
  state: MatchArbiterRequestsState,
): boolean {
  return state.can_submit || state.requests.length > 0;
}

export async function createArbiterRequest(
  supabase: SupabaseClient,
  matchId: string,
  imagePath: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("arbiter_request_create", {
    p_match_id: matchId,
    p_image_path: imagePath,
  });
  if (error) throw error;
  return String(data);
}

export async function resolveArbiterRequest(
  supabase: SupabaseClient,
  requestId: string,
): Promise<void> {
  const { error } = await supabase.rpc("arbiter_request_resolve", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export type OpenArbiterInboxItem = {
  id: string;
  match_id: string;
  board: number | null;
  description: string | null;
  image_path: string | null;
  status: string;
  created_at: string;
  match: {
    round: number;
    datetime: string;
    group_id: string;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  } | null;
};
