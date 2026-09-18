/**
 * Apply contract/score corrections to Honor board results.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vulnerability } from "@/lib/boards/types";
import { recalculateHonorButler } from "@/lib/butler/recalculate";
import type { CorrectionInput } from "@/lib/results/types";
import {
  maybeRefreshPublishedMatchScores,
  type RefreshMatchScoresResult,
} from "@/lib/results/refresh-published-scores";
import { computeNsContractScore } from "@/lib/scoring/contract-score";

export async function applyHonorBoardCorrection(params: {
  service: SupabaseClient;
  resultId: string;
  correction: CorrectionInput;
  userId: string;
}): Promise<
  | {
      ok: true;
      resultId: string;
      boardId: string;
      groupId: string;
      tournamentRound: number;
      matchScores: RefreshMatchScoresResult;
    }
  | { ok: false; error: string }
> {
  const { data: existing, error: loadErr } = await params.service
    .from("honor_board_results")
    .select(
      "id, group_id, match_id, board_id, tournament_round, contract_level, contract_denomination, doubling, declarer, tricks_result, tricks_taken, ns_score, computed_score",
    )
    .eq("id", params.resultId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };
  if (!existing) return { ok: false, error: "Resultaat niet gevonden." };

  const { data: board, error: boardErr } = await params.service
    .from("honor_boards")
    .select("id, vulnerability")
    .eq("id", existing.board_id)
    .maybeSingle();
  if (boardErr) return { ok: false, error: boardErr.message };
  if (!board) return { ok: false, error: "Bord niet gevonden." };

  const next = {
    contract_level:
      params.correction.contractLevel !== undefined
        ? params.correction.contractLevel
        : existing.contract_level,
    contract_denomination:
      params.correction.contractDenomination !== undefined
        ? params.correction.contractDenomination
        : existing.contract_denomination,
    doubling: params.correction.doubling ?? existing.doubling ?? "NONE",
    declarer:
      params.correction.declarer !== undefined
        ? params.correction.declarer
        : existing.declarer,
    tricks_result:
      params.correction.tricksResult !== undefined
        ? params.correction.tricksResult
        : existing.tricks_result,
    tricks_taken:
      params.correction.tricksTaken !== undefined
        ? params.correction.tricksTaken
        : existing.tricks_taken,
  };

  let computedScore = computeNsContractScore({
    contractLevel: next.contract_level as number | null,
    contractDenomination: next.contract_denomination as never,
    doubling: next.doubling as never,
    declarer: next.declarer as never,
    tricksResult: next.tricks_result as string | null,
    tricksTaken: next.tricks_taken as number | null,
    vulnerability: (board.vulnerability as Vulnerability) ?? "NONE",
  });

  if (
    params.correction.nsScore !== undefined &&
    params.correction.nsScore !== null &&
    computedScore == null
  ) {
    computedScore = params.correction.nsScore;
  }

  const nsScore =
    params.correction.nsScore !== undefined && params.correction.nsScore !== null
      ? params.correction.nsScore
      : computedScore;

  const now = new Date().toISOString();
  const { error: updateErr } = await params.service
    .from("honor_board_results")
    .update({
      ...next,
      ns_score: nsScore,
      computed_score: computedScore,
      correction_status: "corrected",
      corrected_at: now,
      validation_status: "valid",
      validation_errors: [],
      special_result_kind: "none",
      included_in_datum: true,
      included_in_match_score: true,
      admin_adjusted_ns_score: null,
      admin_ns_butler_imps: null,
      admin_ew_butler_imps: null,
      datum_eligible: null,
      adjustment_mode: "correction",
      adjustment_meta: {
        reason: params.correction.reason ?? null,
        previous: {
          contract_level: existing.contract_level,
          contract_denomination: existing.contract_denomination,
          doubling: existing.doubling,
          declarer: existing.declarer,
          tricks_result: existing.tricks_result,
          tricks_taken: existing.tricks_taken,
          ns_score: existing.ns_score,
          computed_score: existing.computed_score,
        },
      },
      import_source: "correction",
      updated_at: now,
    })
    .eq("id", existing.id);

  if (updateErr) return { ok: false, error: updateErr.message };

  const butler = await recalculateHonorButler(params.service, {
    groupId: existing.group_id as string,
    boardId: existing.board_id as string,
  });
  if (!butler.ok) return { ok: false, error: butler.error };

  const matchScores = await maybeRefreshPublishedMatchScores(params.service, {
    groupId: existing.group_id as string,
    tournamentRound: existing.tournament_round as number,
    userId: params.userId,
  });

  return {
    ok: true,
    resultId: existing.id as string,
    boardId: existing.board_id as string,
    groupId: existing.group_id as string,
    tournamentRound: existing.tournament_round as number,
    matchScores,
  };
}
