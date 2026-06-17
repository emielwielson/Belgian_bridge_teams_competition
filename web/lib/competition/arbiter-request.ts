import type { SupabaseClient } from "@supabase/supabase-js";
import { ErrorCodes, type ErrorCode } from "@/lib/http/error-codes";
import { loadGroupScoringContext } from "@/lib/competition/match-scoring-context";
import { parsePenaltyInputList } from "@/lib/competition/penalties";
import { parseWarningInputList } from "@/lib/competition/warnings";
import {
  allowsBoardChoice,
  validateScoreBoardOptions,
  BoardCountValidationError,
} from "@/lib/scoring/board-count-rules";
import type { ScorePayload } from "@/lib/scoring/match-operations";

export type ArbiterRequestRow = {
  id: string;
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

export type ResolveScoreChangePayload = {
  imps_home: number;
  imps_away: number;
  mis_seating: boolean;
  selected_board_count: number | null;
  vp_board_count: number;
};

export type ResolveActionsRpcPayload = {
  score_change?: ResolveScoreChangePayload;
  penalties?: Array<{
    team_id: string;
    penalty_date: string;
    reason: string;
    vp_deduction: number;
  }>;
  warnings?: Array<{
    team_id: string;
    warning_date: string;
    reason: string;
  }>;
};

export type ResolveArbiterRequestResult = {
  rulingId: string;
  score: {
    imps_home: number;
    imps_away: number;
    vp_home: number;
    vp_away: number;
    vp_board_count: number;
    mis_seating: boolean;
    selected_board_count: number | null;
  } | null;
  penaltyIds: string[];
  warningIds: string[];
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
      const descriptionRaw = row.description;
      return {
        id: String(row.id),
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

function parseScoreChangeBody(
  raw: unknown,
): ScorePayload | null | { error: ErrorCode } {
  if (raw == null) return null;
  if (typeof raw !== "object") {
    return { error: ErrorCodes.api.invalidRequestBody };
  }
  const body = raw as Record<string, unknown>;
  const impsHome = Number(body.imps_home ?? body.impsHome);
  const impsAway = Number(body.imps_away ?? body.impsAway);
  if (!Number.isFinite(impsHome) || !Number.isFinite(impsAway)) {
    return { error: ErrorCodes.api.impsMustBeNumbers };
  }

  const payload: ScorePayload = { impsHome, impsAway };

  if (body.mis_seating != null || body.misSeating != null) {
    payload.misSeating = Boolean(body.mis_seating ?? body.misSeating);
  }

  const rawBoard =
    body.selected_board_count ?? body.selectedBoardCount ?? null;
  if (rawBoard != null && rawBoard !== "") {
    const selectedBoardCount = Number(rawBoard);
    if (!Number.isFinite(selectedBoardCount)) {
      return { error: ErrorCodes.api.invalidRequestBody };
    }
    payload.selectedBoardCount = selectedBoardCount;
  }

  return payload;
}

function parseResolveResult(raw: unknown): ResolveArbiterRequestResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid resolve response");
  }
  const o = raw as Record<string, unknown>;
  const scoreRaw = o.score;
  let score: ResolveArbiterRequestResult["score"] = null;
  if (scoreRaw && typeof scoreRaw === "object") {
    const s = scoreRaw as Record<string, unknown>;
    score = {
      imps_home: Number(s.imps_home),
      imps_away: Number(s.imps_away),
      vp_home: Number(s.vp_home),
      vp_away: Number(s.vp_away),
      vp_board_count: Number(s.vp_board_count),
      mis_seating: Boolean(s.mis_seating),
      selected_board_count:
        s.selected_board_count != null
          ? Number(s.selected_board_count)
          : null,
    };
  }

  return {
    rulingId: String(o.ruling_id),
    score,
    penaltyIds: Array.isArray(o.penalty_ids)
      ? o.penalty_ids.map(String)
      : [],
    warningIds: Array.isArray(o.warning_ids)
      ? o.warning_ids.map(String)
      : [],
  };
}

export async function buildResolveActionsPayload(
  supabase: SupabaseClient,
  groupId: string,
  body: Record<string, unknown>,
): Promise<ResolveActionsRpcPayload | { error: ErrorCode }> {
  const actions: ResolveActionsRpcPayload = {};

  const scoreRaw = body.score_change ?? body.scoreChange;
  const scoreParsed = parseScoreChangeBody(scoreRaw);
  if (scoreParsed && "error" in scoreParsed) return scoreParsed;
  if (scoreParsed) {
    try {
      const scoringContext = await loadGroupScoringContext(supabase, groupId);
      const boardOptions = validateScoreBoardOptions(scoringContext, {
        selectedBoardCount: scoreParsed.selectedBoardCount,
        misSeating: scoreParsed.misSeating,
      });
      actions.score_change = {
        imps_home: scoreParsed.impsHome,
        imps_away: scoreParsed.impsAway,
        mis_seating: boardOptions.misSeating,
        selected_board_count: allowsBoardChoice(scoringContext)
          ? boardOptions.nominal
          : null,
        vp_board_count: boardOptions.vpBoardCount,
      };
    } catch (e) {
      if (e instanceof BoardCountValidationError) {
        return { error: ErrorCodes.api.invalidRequestBody };
      }
      throw e;
    }
  }

  const penaltiesRaw = body.penalties;
  const penaltiesParsed = parsePenaltyInputList(penaltiesRaw);
  if ("error" in penaltiesParsed) return penaltiesParsed;
  if (penaltiesParsed.length > 0) {
    actions.penalties = penaltiesParsed.map((p) => ({
      team_id: p.teamId,
      penalty_date: p.penaltyDate,
      reason: p.reason,
      vp_deduction: p.vpDeduction,
    }));
  }

  const warningsRaw = body.warnings;
  const warningsParsed = parseWarningInputList(warningsRaw);
  if ("error" in warningsParsed) return warningsParsed;
  if (warningsParsed.length > 0) {
    actions.warnings = warningsParsed.map((w) => ({
      team_id: w.teamId,
      warning_date: w.warningDate,
      reason: w.reason,
    }));
  }

  return actions;
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

export async function loadMatchArbiterRequestsForUser(
  supabase: SupabaseClient,
  matchId: string,
): Promise<{
  state: MatchArbiterRequestsState | null;
  canSubmitScore: boolean;
}> {
  const { data: canSubmitScore, error: scoreError } = await supabase.rpc(
    "current_user_can_submit_score",
    { p_match_id: matchId },
  );
  if (scoreError) throw scoreError;
  const maySubmitScore = Boolean(canSubmitScore);

  try {
    const state = await getMatchArbiterRequestsState(supabase, matchId);
    if (!state) {
      return { state: null, canSubmitScore: maySubmitScore };
    }
    return {
      state: {
        ...state,
        can_submit: state.can_submit || maySubmitScore,
      },
      canSubmitScore: maySubmitScore,
    };
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Forbidden") &&
      maySubmitScore
    ) {
      return {
        state: {
          match_id: matchId,
          can_submit: true,
          requests: [],
        },
        canSubmitScore: true,
      };
    }
    throw err;
  }
}

export function canAccessArbiterRequestWorkflow(
  state: MatchArbiterRequestsState,
  canSubmitScore = false,
): boolean {
  return canSubmitScore || state.can_submit || state.requests.length > 0;
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
  params: {
    filePath: string;
    actions?: ResolveActionsRpcPayload;
  },
): Promise<ResolveArbiterRequestResult> {
  const { data, error } = await supabase.rpc("arbiter_request_resolve", {
    p_request_id: requestId,
    p_ruling_file_path: params.filePath,
    p_actions: params.actions ?? {},
  });
  if (error) throw error;
  return parseResolveResult(data);
}

export type InboxMatchContext = {
  round: number;
  datetime: string;
  group_id: string;
  home_team_id: string;
  away_team_id: string;
  imps_home: number | null;
  imps_away: number | null;
  vp_home: number | null;
  vp_away: number | null;
  played_at: string | null;
  mis_seating: boolean;
  vp_board_count: number | null;
  selected_board_count: number | null;
  board_count: number;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  allows_board_choice: boolean;
};

export type OpenArbiterInboxItem = {
  id: string;
  match_id: string;
  description: string | null;
  image_path: string | null;
  status: string;
  created_at: string;
  match: InboxMatchContext | null;
};
