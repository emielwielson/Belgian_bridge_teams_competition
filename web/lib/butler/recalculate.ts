/**
 * Persist Butler IMPs for Honor board results (round / group scope).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveNsScoreForDatum } from "@/lib/butler/special-results";
import {
  scoreBoard,
  type ButlerResultInput,
} from "@/lib/butler/engine";

export type RecalculateOk = {
  ok: true;
  boardIds: string[];
  resultCount: number;
  updatedCount: number;
};

export type RecalculateErr = { ok: false; error: string };

type ResultRow = {
  id: string;
  board_id: string;
  ns_combination_id: string | null;
  ew_combination_id: string | null;
  included_in_datum: boolean;
  ns_score: number | null;
  computed_score: number | null;
  admin_adjusted_ns_score: number | null;
  admin_ns_butler_imps: number | null;
  admin_ew_butler_imps: number | null;
};

function toInput(r: ResultRow): ButlerResultInput {
  return {
    id: r.id,
    // Credit combinations via pairId slots for scoreBoard aggregation helpers
    nsPairId: r.ns_combination_id,
    ewPairId: r.ew_combination_id,
    includedInDatum: r.included_in_datum,
    nsScoreForDatum: effectiveNsScoreForDatum({
      adminAdjustedNsScore: r.admin_adjusted_ns_score,
      nsScore: r.ns_score,
      computedScore: r.computed_score,
    }),
    adminNsButlerImps: r.admin_ns_butler_imps,
    adminEwButlerImps: r.admin_ew_butler_imps,
  };
}

export async function recalculateHonorButler(
  service: SupabaseClient,
  params: {
    groupId: string;
    tournamentRound?: number;
    boardId?: string;
  },
): Promise<RecalculateOk | RecalculateErr> {
  let query = service
    .from("honor_board_results")
    .select(
      "id, board_id, ns_combination_id, ew_combination_id, included_in_datum, ns_score, computed_score, admin_adjusted_ns_score, admin_ns_butler_imps, admin_ew_butler_imps",
    )
    .eq("group_id", params.groupId);

  if (params.boardId) {
    query = query.eq("board_id", params.boardId);
  } else if (params.tournamentRound != null) {
    query = query.eq("tournament_round", params.tournamentRound);
  }

  const { data: results, error } = await query;
  if (error) return { ok: false, error: error.message };
  const rows = (results ?? []) as ResultRow[];

  // When recalculating a round, still load all results per affected board
  // so datum includes every table (already true when filtering by round).
  let workRows = rows;
  if (params.tournamentRound != null && !params.boardId) {
    const boardIds = [...new Set(rows.map((r) => r.board_id))];
    if (boardIds.length > 0) {
      const { data: allForBoards, error: e2 } = await service
        .from("honor_board_results")
        .select(
          "id, board_id, ns_combination_id, ew_combination_id, included_in_datum, ns_score, computed_score, admin_adjusted_ns_score, admin_ns_butler_imps, admin_ew_butler_imps",
        )
        .in("board_id", boardIds);
      if (e2) return { ok: false, error: e2.message };
      workRows = (allForBoards ?? []) as ResultRow[];
    }
  }

  const byBoard = new Map<string, ResultRow[]>();
  for (const r of workRows) {
    const list = byBoard.get(r.board_id) ?? [];
    list.push(r);
    byBoard.set(r.board_id, list);
  }

  let updatedCount = 0;
  const boardIds = [...byBoard.keys()];

  for (const [boardId, boardResults] of byBoard) {
    const scored = scoreBoard(boardResults.map(toInput));

    await service
      .from("honor_boards")
      .update({
        ns_datum: scored.nsDatum,
        ew_datum: scored.ewDatum,
        updated_at: new Date().toISOString(),
      })
      .eq("id", boardId);

    for (const s of scored.results) {
      const { error: uErr } = await service
        .from("honor_board_results")
        .update({
          ns_butler_imps: s.nsButlerImps,
          ew_butler_imps: s.ewButlerImps,
          score_diff: s.scoreDiff,
          processing_status: "calculated",
          updated_at: new Date().toISOString(),
        })
        .eq("id", s.id);
      if (!uErr) updatedCount++;
    }
  }

  return {
    ok: true,
    boardIds,
    resultCount: workRows.length,
    updatedCount,
  };
}
