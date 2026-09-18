/**
 * Derive Honor team match IMPs from open/closed Bridgemate board results,
 * then look up and persist VPs on `matches` at round publish.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveNsScoreForDatum } from "@/lib/butler/special-results";
import type { HonorRoundMatchSeating } from "@/lib/competition/honor-seating-overview";
import { pointsToImps } from "@/lib/scoring/wbf-imp-table";
import { lookupVp } from "@/lib/scoring/vp-lookup";

export type HonorBoardNsPair = {
  openNs: number;
  closedNs: number;
};

export type HonorMatchImps = {
  impsHome: number;
  impsAway: number;
};

export type HonorPublishedMatchScore = {
  matchId: string;
  impsHome: number;
  impsAway: number;
  vpHome: number;
  vpAway: number;
};

/**
 * Open room NS = home; closed room NS = away.
 * Home point difference = openNs - closedNs → WBF IMPs, then split into positive totals.
 */
export function computeHonorMatchImps(
  boards: HonorBoardNsPair[],
): HonorMatchImps {
  let impsHome = 0;
  let impsAway = 0;
  for (const board of boards) {
    const boardImps = pointsToImps(board.openNs - board.closedNs);
    if (boardImps > 0) impsHome += boardImps;
    else if (boardImps < 0) impsAway += -boardImps;
  }
  return { impsHome, impsAway };
}

type ResultRow = {
  match_id: string;
  room: string;
  board_id: string;
  ns_score: number | null;
  computed_score: number | null;
  admin_adjusted_ns_score: number | null;
  included_in_match_score: boolean | null;
};

export function groupHonorMatchBoardPairs(
  rows: ResultRow[],
  matchId: string,
): HonorBoardNsPair[] | { error: string } {
  return groupBoardPairs(rows, matchId);
}

function groupBoardPairs(
  rows: ResultRow[],
  matchId: string,
): HonorBoardNsPair[] | { error: string } {
  const byBoard = new Map<
    string,
    {
      openNs: number | null;
      closedNs: number | null;
      openIncluded: boolean;
      closedIncluded: boolean;
      seenOpen: boolean;
      seenClosed: boolean;
    }
  >();

  for (const row of rows) {
    if (row.match_id !== matchId) continue;
    if (row.room !== "open" && row.room !== "closed") continue;

    const included = row.included_in_match_score !== false;
    const entry = byBoard.get(row.board_id) ?? {
      openNs: null,
      closedNs: null,
      openIncluded: true,
      closedIncluded: true,
      seenOpen: false,
      seenClosed: false,
    };

    if (!included) {
      if (row.room === "open") {
        entry.openIncluded = false;
        entry.seenOpen = true;
      } else {
        entry.closedIncluded = false;
        entry.seenClosed = true;
      }
      byBoard.set(row.board_id, entry);
      continue;
    }

    const ns = effectiveNsScoreForDatum({
      adminAdjustedNsScore: row.admin_adjusted_ns_score,
      nsScore: row.ns_score,
      computedScore: row.computed_score,
    });
    if (ns == null) {
      return {
        error: `Match ${matchId}: missing NS score for board ${row.board_id} (${row.room})`,
      };
    }

    if (row.room === "open") {
      entry.openNs = ns;
      entry.seenOpen = true;
    } else {
      entry.closedNs = ns;
      entry.seenClosed = true;
    }
    byBoard.set(row.board_id, entry);
  }

  const pairs: HonorBoardNsPair[] = [];
  for (const [boardId, entry] of byBoard) {
    if (!entry.openIncluded || !entry.closedIncluded) {
      // Cancelled in either room → skip board for match IMPs
      continue;
    }
    if (entry.openNs == null || entry.closedNs == null) {
      return {
        error: `Match ${matchId}: incomplete open/closed pair for board ${boardId}`,
      };
    }
    pairs.push({ openNs: entry.openNs, closedNs: entry.closedNs });
  }

  if (pairs.length === 0) {
    return {
      error: `Match ${matchId}: geen borden inbegrepen in de wedstrijdscore`,
    };
  }

  return pairs;
}

export async function applyHonorRoundMatchScores(
  service: SupabaseClient,
  params: {
    groupId: string;
    tournamentRound: number;
    matches: HonorRoundMatchSeating[];
    userId?: string | null;
  },
): Promise<
  | { ok: true; scores: HonorPublishedMatchScore[] }
  | { ok: false; error: string }
> {
  if (params.matches.length === 0) {
    return { ok: false, error: "Geen wedstrijden in deze ronde." };
  }

  const matchIds = params.matches.map((m) => m.match_id);

  const { data: matchRows, error: matchErr } = await service
    .from("matches")
    .select("id")
    .in("id", matchIds);

  if (matchErr) {
    return { ok: false, error: matchErr.message };
  }

  const matchIdsFound = new Set((matchRows ?? []).map((m) => m.id as string));

  const { data: results, error: resultsErr } = await service
    .from("honor_board_results")
    .select(
      "match_id, room, board_id, ns_score, computed_score, admin_adjusted_ns_score, included_in_match_score",
    )
    .eq("group_id", params.groupId)
    .eq("tournament_round", params.tournamentRound)
    .in("match_id", matchIds);

  if (resultsErr) {
    return { ok: false, error: resultsErr.message };
  }

  const resultRows = (results ?? []) as ResultRow[];
  const scores: HonorPublishedMatchScore[] = [];

  for (const seating of params.matches) {
    if (!matchIdsFound.has(seating.match_id)) {
      return { ok: false, error: `Wedstrijd ${seating.match_id} niet gevonden.` };
    }

    const pairsOrErr = groupBoardPairs(resultRows, seating.match_id);
    if ("error" in pairsOrErr) {
      return { ok: false, error: pairsOrErr.error };
    }

    const { impsHome, impsAway } = computeHonorMatchImps(pairsOrErr);
    // NG / cancelled boards are already excluded from pairs → VP scale = boards played
    const boardCountForVp = pairsOrErr.length;

    let vpHome: number;
    let vpAway: number;
    try {
      const vp = await lookupVp(service, {
        groupId: params.groupId,
        boardCount: boardCountForVp,
        impsHome,
        impsAway,
        allowWbfFallback: true,
      });
      vpHome = vp.vpHome;
      vpAway = vp.vpAway;
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "VP-lookup mislukt.",
      };
    }

    const { error: updateErr } = await service
      .from("matches")
      .update({
        imps_home: impsHome,
        imps_away: impsAway,
        vp_home: vpHome,
        vp_away: vpAway,
        vp_board_count: boardCountForVp,
      })
      .eq("id", seating.match_id);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    if (params.userId) {
      const logPayload = {
        imps_home: impsHome,
        imps_away: impsAway,
        vp_home: vpHome,
        vp_away: vpAway,
        vp_board_count: boardCountForVp,
        tournament_round: params.tournamentRound,
      };
      const { error: logErr } = await service.from("match_logs").insert({
        match_id: seating.match_id,
        action: `score_honor_publish:${JSON.stringify(logPayload)}`,
        user_id: params.userId,
      });
      if (logErr) {
        return { ok: false, error: logErr.message };
      }
    }

    scores.push({
      matchId: seating.match_id,
      impsHome,
      impsAway,
      vpHome,
      vpAway,
    });
  }

  return { ok: true, scores };
}
