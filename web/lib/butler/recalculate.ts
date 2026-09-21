/**
 * Persist Butler IMPs for Honor board results (round / group scope).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  butlerImpsForAverageAward,
  combinationRoundAverages,
} from "@/lib/butler/average-pm-butler";
import {
  effectiveEwScoreForDatum,
  effectiveNsScoreForDatum,
} from "@/lib/butler/special-results";
import {
  scoreBoard,
  type ButlerResultInput,
} from "@/lib/butler/engine";
import {
  parseAveragePmAwards,
} from "@/lib/results/adjustment-helpers";

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
  tournament_round: number;
  ns_combination_id: string | null;
  ew_combination_id: string | null;
  included_in_datum: boolean;
  ns_score: number | null;
  computed_score: number | null;
  admin_adjusted_ns_score: number | null;
  admin_adjusted_ew_score: number | null;
  admin_ns_butler_imps: number | null;
  admin_ew_butler_imps: number | null;
  adjustment_mode: string | null;
  adjustment_meta: Record<string, unknown> | null;
};

const RESULT_SELECT =
  "id, board_id, tournament_round, ns_combination_id, ew_combination_id, included_in_datum, ns_score, computed_score, admin_adjusted_ns_score, admin_adjusted_ew_score, admin_ns_butler_imps, admin_ew_butler_imps, adjustment_mode, adjustment_meta";

function isAveragePmRow(r: ResultRow): boolean {
  return r.adjustment_mode === "average_pm";
}

function toInput(r: ResultRow): ButlerResultInput {
  const averagePm = isAveragePmRow(r);
  return {
    id: r.id,
    nsPairId: r.ns_combination_id,
    ewPairId: r.ew_combination_id,
    // Average± tables never feed the datum; strip admin IMPs so pass 1 leaves nulls
    includedInDatum: averagePm ? false : r.included_in_datum,
    nsScoreForDatum: averagePm
      ? null
      : effectiveNsScoreForDatum({
          adminAdjustedNsScore: r.admin_adjusted_ns_score,
          nsScore: r.ns_score,
          computedScore: r.computed_score,
        }),
    ewScoreForDatum: averagePm
      ? null
      : effectiveEwScoreForDatum({
          adminAdjustedEwScore: r.admin_adjusted_ew_score,
        }),
    adminNsButlerImps: averagePm ? null : r.admin_ns_butler_imps,
    adminEwButlerImps: averagePm ? null : r.admin_ew_butler_imps,
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
  // Single-board recalc expands to the round when any average_pm exists there,
  // so combination averages stay consistent.
  if (params.boardId && params.tournamentRound == null) {
    const { data: probe, error: probeErr } = await service
      .from("honor_board_results")
      .select("tournament_round, adjustment_mode")
      .eq("group_id", params.groupId)
      .eq("board_id", params.boardId);

    if (probeErr) return { ok: false, error: probeErr.message };
    const probeRows = (probe ?? []) as {
      tournament_round: number;
      adjustment_mode: string | null;
    }[];
    const round = probeRows[0]?.tournament_round;
    if (round != null) {
      const { data: roundProbe, error: roundErr } = await service
        .from("honor_board_results")
        .select("id")
        .eq("group_id", params.groupId)
        .eq("tournament_round", round)
        .eq("adjustment_mode", "average_pm")
        .limit(1);
      if (roundErr) return { ok: false, error: roundErr.message };
      if ((roundProbe ?? []).length > 0) {
        return recalculateHonorButler(service, {
          groupId: params.groupId,
          tournamentRound: round,
        });
      }
    }
  }

  let query = service
    .from("honor_board_results")
    .select(RESULT_SELECT)
    .eq("group_id", params.groupId);

  if (params.boardId && params.tournamentRound == null) {
    query = query.eq("board_id", params.boardId);
  } else if (params.tournamentRound != null) {
    query = query.eq("tournament_round", params.tournamentRound);
  }

  const { data: results, error } = await query;
  if (error) return { ok: false, error: error.message };
  const rows = (results ?? []) as ResultRow[];

  let workRows = rows;
  if (params.tournamentRound != null) {
    const boardIds = [...new Set(rows.map((r) => r.board_id))];
    if (boardIds.length > 0) {
      const { data: allForBoards, error: e2 } = await service
        .from("honor_board_results")
        .select(RESULT_SELECT)
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

  const pass1ById = new Map<
    string,
    { nsButlerImps: number | null; ewButlerImps: number | null; scoreDiff: number | null }
  >();
  const boardDatums = new Map<
    string,
    { nsDatum: number | null; ewDatum: number | null }
  >();

  for (const [boardId, boardResults] of byBoard) {
    const scored = scoreBoard(boardResults.map(toInput));
    boardDatums.set(boardId, {
      nsDatum: scored.nsDatum,
      ewDatum: scored.ewDatum,
    });
    for (const s of scored.results) {
      pass1ById.set(s.id, {
        nsButlerImps: s.nsButlerImps,
        ewButlerImps: s.ewButlerImps,
        scoreDiff: s.scoreDiff,
      });
    }
  }

  // Pass-1 credits for round averages (only within this tournament round)
  const roundFilter =
    params.tournamentRound != null
      ? params.tournamentRound
      : workRows[0]?.tournament_round;
  const credits: { combinationId: string; imps: number }[] = [];
  for (const r of workRows) {
    if (roundFilter != null && r.tournament_round !== roundFilter) continue;
    if (isAveragePmRow(r)) continue;
    const scored = pass1ById.get(r.id);
    if (!scored) continue;
    if (scored.nsButlerImps != null && r.ns_combination_id) {
      credits.push({
        combinationId: r.ns_combination_id,
        imps: scored.nsButlerImps,
      });
    }
    if (scored.ewButlerImps != null && r.ew_combination_id) {
      credits.push({
        combinationId: r.ew_combination_id,
        imps: scored.ewButlerImps,
      });
    }
  }
  const averages = combinationRoundAverages(credits);

  let updatedCount = 0;
  const boardIds = [...byBoard.keys()];

  for (const [boardId, boardResults] of byBoard) {
    const datum = boardDatums.get(boardId);
    await service
      .from("honor_boards")
      .update({
        ns_datum: datum?.nsDatum ?? null,
        ew_datum: datum?.ewDatum ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", boardId);

    for (const r of boardResults) {
      const pass1 = pass1ById.get(r.id) ?? {
        nsButlerImps: null,
        ewButlerImps: null,
        scoreDiff: null,
      };

      let nsButlerImps = pass1.nsButlerImps;
      let ewButlerImps = pass1.ewButlerImps;
      let scoreDiff = pass1.scoreDiff;

      if (isAveragePmRow(r)) {
        const { nsAward, ewAward } = parseAveragePmAwards(r.adjustment_meta);
        if (nsAward) {
          const avg = r.ns_combination_id
            ? (averages.get(r.ns_combination_id) ?? null)
            : null;
          nsButlerImps = butlerImpsForAverageAward(nsAward, avg);
        } else {
          nsButlerImps = null;
        }
        if (ewAward) {
          const avg = r.ew_combination_id
            ? (averages.get(r.ew_combination_id) ?? null)
            : null;
          ewButlerImps = butlerImpsForAverageAward(ewAward, avg);
        } else {
          ewButlerImps = null;
        }
        scoreDiff = null;
      }

      const { error: uErr } = await service
        .from("honor_board_results")
        .update({
          ns_butler_imps: nsButlerImps,
          ew_butler_imps: ewButlerImps,
          score_diff: scoreDiff,
          processing_status: "calculated",
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);
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
