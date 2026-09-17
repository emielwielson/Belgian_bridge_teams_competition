/**
 * Public Honor Butler standings queries (published rounds only).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateCombinationRoundMatrix,
  aggregateCombinationStandings,
} from "@/lib/butler/engine";

export type PublicCombinationStandingRow = {
  combinationId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  totalImps: number;
  boardsPlayed: number;
  averageImps: number | null;
  rank: number;
};

export type PublicRoundColumn = {
  tournamentRound: number;
};

export async function getPublishedCombinationStandings(
  client: SupabaseClient,
  groupId: string,
): Promise<{
  combinations: PublicCombinationStandingRow[];
  rounds: PublicRoundColumn[];
  matrix: Record<string, Record<number, { imps: number; boards: number }>>;
}> {
  const { data: pubs } = await client
    .from("honor_round_publication")
    .select("tournament_round")
    .eq("group_id", groupId)
    .eq("status", "published")
    .order("tournament_round");

  const publishedRounds = (pubs ?? []).map((p) => p.tournament_round as number);
  if (!publishedRounds.length) {
    return { combinations: [], rounds: [], matrix: {} };
  }

  const { data: results } = await client
    .from("honor_board_results")
    .select(
      "ns_combination_id, ew_combination_id, ns_butler_imps, ew_butler_imps, tournament_round",
    )
    .eq("group_id", groupId)
    .eq("processing_status", "published")
    .in("tournament_round", publishedRounds);

  const credits: {
    combinationId: string;
    imps: number;
    roundId: string;
  }[] = [];

  for (const r of results ?? []) {
    const roundId = String(r.tournament_round);
    if (r.ns_butler_imps != null && r.ns_combination_id) {
      credits.push({
        combinationId: r.ns_combination_id,
        imps: Number(r.ns_butler_imps),
        roundId,
      });
    }
    if (r.ew_butler_imps != null && r.ew_combination_id) {
      credits.push({
        combinationId: r.ew_combination_id,
        imps: Number(r.ew_butler_imps),
        roundId,
      });
    }
  }

  const standings = aggregateCombinationStandings(credits);
  const cells = aggregateCombinationRoundMatrix(credits);

  const comboIds = standings.map((s) => s.combinationId);
  const { data: combos } = comboIds.length
    ? await client
        .from("honor_player_combinations")
        .select("id, display_name, team_id, teams(name)")
        .in("id", comboIds)
    : { data: [] };

  const comboMap = new Map(
    (combos ?? []).map((c) => {
      const team = c.teams as { name: string } | { name: string }[] | null;
      const teamName = Array.isArray(team)
        ? (team[0]?.name ?? "")
        : (team?.name ?? "");
      return [
        c.id as string,
        {
          displayName: c.display_name as string,
          teamId: c.team_id as string,
          teamName,
        },
      ];
    }),
  );

  const combinations: PublicCombinationStandingRow[] = standings.map((s) => {
    const meta = comboMap.get(s.combinationId);
    return {
      combinationId: s.combinationId,
      displayName: meta?.displayName ?? s.combinationId,
      teamId: meta?.teamId ?? "",
      teamName: meta?.teamName ?? "",
      totalImps: s.totalImps,
      boardsPlayed: s.boardsPlayed,
      averageImps: s.averageImps,
      rank: s.rank,
    };
  });

  const matrix: Record<string, Record<number, { imps: number; boards: number }>> =
    {};
  for (const cell of cells) {
    const round = Number(cell.roundId);
    if (!matrix[cell.combinationId]) matrix[cell.combinationId] = {};
    matrix[cell.combinationId]![round] = {
      imps: cell.totalImps,
      boards: cell.boardsPlayed,
    };
  }

  return {
    combinations,
    rounds: publishedRounds.map((tournamentRound) => ({ tournamentRound })),
    matrix,
  };
}

export async function getPublishedRoundStandings(
  client: SupabaseClient,
  groupId: string,
  tournamentRound: number,
): Promise<PublicCombinationStandingRow[]> {
  const { data: pub } = await client
    .from("honor_round_publication")
    .select("status")
    .eq("group_id", groupId)
    .eq("tournament_round", tournamentRound)
    .maybeSingle();

  if (pub?.status !== "published") return [];

  const { data: results } = await client
    .from("honor_board_results")
    .select(
      "ns_combination_id, ew_combination_id, ns_butler_imps, ew_butler_imps, tournament_round",
    )
    .eq("group_id", groupId)
    .eq("tournament_round", tournamentRound)
    .eq("processing_status", "published");

  const credits: { combinationId: string; imps: number; roundId: string }[] =
    [];
  for (const r of results ?? []) {
    if (r.ns_butler_imps != null && r.ns_combination_id) {
      credits.push({
        combinationId: r.ns_combination_id,
        imps: Number(r.ns_butler_imps),
        roundId: String(tournamentRound),
      });
    }
    if (r.ew_butler_imps != null && r.ew_combination_id) {
      credits.push({
        combinationId: r.ew_combination_id,
        imps: Number(r.ew_butler_imps),
        roundId: String(tournamentRound),
      });
    }
  }

  const standings = aggregateCombinationStandings(credits);
  const comboIds = standings.map((s) => s.combinationId);
  const { data: combos } = comboIds.length
    ? await client
        .from("honor_player_combinations")
        .select("id, display_name, team_id, teams(name)")
        .in("id", comboIds)
    : { data: [] };

  const comboMap = new Map(
    (combos ?? []).map((c) => {
      const team = c.teams as { name: string } | { name: string }[] | null;
      const teamName = Array.isArray(team)
        ? (team[0]?.name ?? "")
        : (team?.name ?? "");
      return [
        c.id as string,
        {
          displayName: c.display_name as string,
          teamId: c.team_id as string,
          teamName,
        },
      ];
    }),
  );

  return standings.map((s) => {
    const meta = comboMap.get(s.combinationId);
    return {
      combinationId: s.combinationId,
      displayName: meta?.displayName ?? s.combinationId,
      teamId: meta?.teamId ?? "",
      teamName: meta?.teamName ?? "",
      totalImps: s.totalImps,
      boardsPlayed: s.boardsPlayed,
      averageImps: s.averageImps,
      rank: s.rank,
    };
  });
}
