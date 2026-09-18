/**
 * Public Honor Butler standings queries (published rounds only).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateCombinationRoundMatrix,
  aggregateCombinationStandings,
  aggregatePlayerStandingsByAverage,
  type PlayerImpCredit,
} from "@/lib/butler/engine";
import { formatPersonName } from "@/lib/butler/person-name";

export type PublicCombinationStandingRow = {
  combinationId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  totalImps: number;
  boardsPlayed: number;
  /** Distinct published rounds with Butler IMP credits (matches played). */
  roundsPlayed: number;
  averageImps: number | null;
  rank: number;
};

export type PublicPlayerStandingRow = {
  playerId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  totalImps: number;
  boardsPlayed: number;
  /** Distinct published rounds with Butler IMP credits (matches played). */
  roundsPlayed: number;
  averageImps: number | null;
  rank: number;
};

export type PublicRoundColumn = {
  tournamentRound: number;
};

function unwrapTeamName(
  teams: { name: string } | { name: string }[] | null,
): string {
  if (!teams) return "";
  return Array.isArray(teams) ? (teams[0]?.name ?? "") : (teams.name ?? "");
}

async function loadPublishedBoardCredits(
  client: SupabaseClient,
  groupId: string,
): Promise<{
  publishedRounds: number[];
  credits: { combinationId: string; imps: number; roundId: string }[];
}> {
  const { data: pubs } = await client
    .from("honor_round_publication")
    .select("tournament_round")
    .eq("group_id", groupId)
    .eq("status", "published")
    .order("tournament_round");

  const publishedRounds = (pubs ?? []).map((p) => p.tournament_round as number);
  if (!publishedRounds.length) {
    return { publishedRounds: [], credits: [] };
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

  return { publishedRounds, credits };
}

export async function getPublishedCombinationStandings(
  client: SupabaseClient,
  groupId: string,
): Promise<{
  combinations: PublicCombinationStandingRow[];
  rounds: PublicRoundColumn[];
  matrix: Record<string, Record<number, { imps: number; boards: number }>>;
}> {
  const { publishedRounds, credits } = await loadPublishedBoardCredits(
    client,
    groupId,
  );
  if (!publishedRounds.length) {
    return { combinations: [], rounds: [], matrix: {} };
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
    (combos ?? []).map((c) => [
      c.id as string,
      {
        displayName: c.display_name as string,
        teamId: c.team_id as string,
        teamName: unwrapTeamName(
          c.teams as { name: string } | { name: string }[] | null,
        ),
      },
    ]),
  );

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

  const combinations: PublicCombinationStandingRow[] = standings.map((s) => {
    const meta = comboMap.get(s.combinationId);
    return {
      combinationId: s.combinationId,
      displayName: meta?.displayName ?? s.combinationId,
      teamId: meta?.teamId ?? "",
      teamName: meta?.teamName ?? "",
      totalImps: s.totalImps,
      boardsPlayed: s.boardsPlayed,
      roundsPlayed: Object.keys(matrix[s.combinationId] ?? {}).length,
      averageImps: s.averageImps,
      rank: s.rank,
    };
  });

  return {
    combinations,
    rounds: publishedRounds.map((tournamentRound) => ({ tournamentRound })),
    matrix,
  };
}

export async function getPublishedPlayerStandings(
  client: SupabaseClient,
  groupId: string,
): Promise<PublicPlayerStandingRow[]> {
  const { publishedRounds, credits } = await loadPublishedBoardCredits(
    client,
    groupId,
  );
  if (!publishedRounds.length || !credits.length) return [];

  const comboIds = [...new Set(credits.map((c) => c.combinationId))];
  const { data: combos } = await client
    .from("honor_player_combinations")
    .select("id, player_low_id, player_high_id, team_id, teams(name)")
    .in("id", comboIds);

  const comboPlayers = new Map(
    (combos ?? []).map((c) => [
      c.id as string,
      {
        playerLowId: c.player_low_id as string,
        playerHighId: c.player_high_id as string,
        teamId: c.team_id as string,
        teamName: unwrapTeamName(
          c.teams as { name: string } | { name: string }[] | null,
        ),
      },
    ]),
  );

  const playerCredits: PlayerImpCredit[] = [];
  const teamBoards = new Map<
    string,
    Map<string, { teamId: string; teamName: string; boards: number }>
  >();
  const playerRounds = new Map<string, Set<string>>();

  for (const credit of credits) {
    const combo = comboPlayers.get(credit.combinationId);
    if (!combo) continue;
    for (const playerId of [combo.playerLowId, combo.playerHighId]) {
      playerCredits.push({ playerId, imps: credit.imps });
      let rounds = playerRounds.get(playerId);
      if (!rounds) {
        rounds = new Set();
        playerRounds.set(playerId, rounds);
      }
      rounds.add(credit.roundId);
      let byTeam = teamBoards.get(playerId);
      if (!byTeam) {
        byTeam = new Map();
        teamBoards.set(playerId, byTeam);
      }
      const key = combo.teamId;
      const cur = byTeam.get(key) ?? {
        teamId: combo.teamId,
        teamName: combo.teamName,
        boards: 0,
      };
      cur.boards += 1;
      byTeam.set(key, cur);
    }
  }

  const standings = aggregatePlayerStandingsByAverage(playerCredits);
  const playerIds = standings.map((s) => s.playerId);
  const { data: players } = playerIds.length
    ? await client.from("players").select("id, name").in("id", playerIds)
    : { data: [] };

  const nameMap = new Map(
    (players ?? []).map((p) => [p.id as string, p.name as string]),
  );

  return standings.map((s) => {
    const teams = teamBoards.get(s.playerId);
    let best = { teamId: "", teamName: "", boards: -1 };
    if (teams) {
      for (const entry of teams.values()) {
        if (
          entry.boards > best.boards ||
          (entry.boards === best.boards &&
            entry.teamId.localeCompare(best.teamId) < 0)
        ) {
          best = entry;
        }
      }
    }
    const rawName = nameMap.get(s.playerId);
    return {
      playerId: s.playerId,
      displayName: rawName ? formatPersonName(rawName) : s.playerId,
      teamId: best.teamId,
      teamName: best.teamName,
      totalImps: s.totalImps,
      boardsPlayed: s.boardsPlayed,
      roundsPlayed: playerRounds.get(s.playerId)?.size ?? 0,
      averageImps: s.averageImps,
      rank: s.rank,
    };
  });
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
    (combos ?? []).map((c) => [
      c.id as string,
      {
        displayName: c.display_name as string,
        teamId: c.team_id as string,
        teamName: unwrapTeamName(
          c.teams as { name: string } | { name: string }[] | null,
        ),
      },
    ]),
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
      roundsPlayed: 1,
      averageImps: s.averageImps,
      rank: s.rank,
    };
  });
}
