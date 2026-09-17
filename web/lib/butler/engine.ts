/**
 * Pure Butler scoring engine (PRD §4.8) — no UI / DB / Bridgemate deps.
 */

import { computeNsDatum, type DatumConfig } from "@/lib/butler/datum";
import { pointsToImps } from "@/lib/scoring/wbf-imp-table";

export type ButlerResultInput = {
  id: string;
  nsPairId: string | null;
  ewPairId: string | null;
  includedInDatum: boolean;
  /** Effective NS score for datum / diff (admin adjusted or ns/computed). */
  nsScoreForDatum: number | null;
  adminNsButlerImps: number | null;
};

export type ButlerBoardResult = {
  id: string;
  nsButlerImps: number | null;
  ewButlerImps: number | null;
  scoreDiff: number | null;
  usedAdminImps: boolean;
};

export type ButlerBoardOutput = {
  nsDatum: number | null;
  ewDatum: number | null;
  datumOk: boolean;
  results: ButlerBoardResult[];
};

export type PairStanding = {
  pairId: string;
  totalImps: number;
  boardsPlayed: number;
  averageImps: number | null;
  rank: number;
};

export type CombinationStanding = {
  combinationId: string;
  totalImps: number;
  boardsPlayed: number;
  averageImps: number | null;
  rank: number;
};

export type CombinationRoundCell = {
  combinationId: string;
  roundId: string;
  totalImps: number;
  boardsPlayed: number;
};

export type PlayerStanding = {
  playerId: string;
  totalImps: number;
  boardsPlayed: number;
  averageImps: number | null;
  rank: number;
};

export type PairPlayers = {
  player1Id: string;
  player2Id: string;
};

export type AggregateConfig = {
  sharedRanksOnTies?: boolean;
};

/**
 * Score one board's table results vs trimmed-mean datum (§4.8.1–4.8.2, §4.8.5).
 */
export function scoreBoard(
  results: readonly ButlerResultInput[],
  datumConfig: DatumConfig = {},
): ButlerBoardOutput {
  const datumScores = results
    .filter((r) => r.includedInDatum && r.nsScoreForDatum != null)
    .map((r) => r.nsScoreForDatum as number);

  const datum = computeNsDatum(datumScores, datumConfig);
  const nsDatum = datum.ok ? datum.nsDatum : null;
  const ewDatum = datum.ok ? datum.ewDatum : null;

  const scored: ButlerBoardResult[] = results.map((r) => {
    if (r.adminNsButlerImps != null) {
      return {
        id: r.id,
        nsButlerImps: r.adminNsButlerImps,
        ewButlerImps: -r.adminNsButlerImps,
        scoreDiff: null,
        usedAdminImps: true,
      };
    }

    // Automatic IMPs only for datum-included results (§4.8.5: specials get no auto IMPs until resolved)
    if (r.includedInDatum && nsDatum != null && r.nsScoreForDatum != null) {
      const scoreDiff = r.nsScoreForDatum - nsDatum;
      const nsButlerImps = pointsToImps(scoreDiff);
      return {
        id: r.id,
        nsButlerImps,
        ewButlerImps: -nsButlerImps,
        scoreDiff,
        usedAdminImps: false,
      };
    }

    return {
      id: r.id,
      nsButlerImps: null,
      ewButlerImps: null,
      scoreDiff: null,
      usedAdminImps: false,
    };
  });

  return {
    nsDatum,
    ewDatum,
    datumOk: datum.ok,
    results: scored,
  };
}

/**
 * Competition (1224) ranking: ties share the min rank; next rank skips.
 * When sharedRanksOnTies is false, use dense 1,2,3… by sort order only (stable unique ranks by index+1).
 */
export function assignSharedRanks(
  totalsDescending: readonly number[],
  sharedRanksOnTies = true,
): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < totalsDescending.length; i++) {
    if (!sharedRanksOnTies) {
      ranks.push(i + 1);
      continue;
    }
    if (i > 0 && totalsDescending[i] === totalsDescending[i - 1]) {
      ranks.push(ranks[i - 1]!);
    } else {
      ranks.push(i + 1);
    }
  }
  return ranks;
}

type BoardImpCredit = {
  pairId: string;
  imps: number;
};

type CombinationImpCredit = {
  combinationId: string;
  imps: number;
  roundId?: string;
};

/**
 * Collect per-board IMP credits for each pair from scored board outputs + inputs.
 */
export function pairBoardCredits(
  inputs: readonly ButlerResultInput[],
  scored: readonly ButlerBoardResult[],
): BoardImpCredit[] {
  const byId = new Map(scored.map((s) => [s.id, s]));
  const credits: BoardImpCredit[] = [];
  for (const input of inputs) {
    const s = byId.get(input.id);
    if (!s) continue;
    if (s.nsButlerImps != null && input.nsPairId) {
      credits.push({ pairId: input.nsPairId, imps: s.nsButlerImps });
    }
    if (s.ewButlerImps != null && input.ewPairId) {
      credits.push({ pairId: input.ewPairId, imps: s.ewButlerImps });
    }
  }
  return credits;
}

function aggregateFromCredits(
  credits: readonly BoardImpCredit[],
): Map<string, { totalImps: number; boardsPlayed: number }> {
  const map = new Map<string, { totalImps: number; boardsPlayed: number }>();
  for (const c of credits) {
    const cur = map.get(c.pairId) ?? { totalImps: 0, boardsPlayed: 0 };
    cur.totalImps += c.imps;
    cur.boardsPlayed += 1;
    map.set(c.pairId, cur);
  }
  return map;
}

export function aggregatePairStandings(
  credits: readonly BoardImpCredit[],
  config: AggregateConfig = {},
): PairStanding[] {
  const map = aggregateFromCredits(credits);
  const rows = [...map.entries()].map(([pairId, v]) => ({
    pairId,
    totalImps: v.totalImps,
    boardsPlayed: v.boardsPlayed,
    averageImps:
      v.boardsPlayed > 0 ? v.totalImps / v.boardsPlayed : null,
  }));
  rows.sort((a, b) => {
    if (b.totalImps !== a.totalImps) return b.totalImps - a.totalImps;
    return a.pairId.localeCompare(b.pairId);
  });
  const ranks = assignSharedRanks(
    rows.map((r) => r.totalImps),
    config.sharedRanksOnTies !== false,
  );
  return rows.map((r, i) => ({ ...r, rank: ranks[i]! }));
}

export function aggregateCombinationStandings(
  credits: readonly CombinationImpCredit[],
  config: AggregateConfig = {},
): CombinationStanding[] {
  const map = new Map<string, { totalImps: number; boardsPlayed: number }>();
  for (const c of credits) {
    const cur = map.get(c.combinationId) ?? { totalImps: 0, boardsPlayed: 0 };
    cur.totalImps += c.imps;
    cur.boardsPlayed += 1;
    map.set(c.combinationId, cur);
  }
  const rows = [...map.entries()].map(([combinationId, v]) => ({
    combinationId,
    totalImps: v.totalImps,
    boardsPlayed: v.boardsPlayed,
    averageImps:
      v.boardsPlayed > 0 ? v.totalImps / v.boardsPlayed : null,
  }));
  rows.sort((a, b) => {
    const avgA = a.averageImps ?? Number.NEGATIVE_INFINITY;
    const avgB = b.averageImps ?? Number.NEGATIVE_INFINITY;
    if (avgB !== avgA) return avgB - avgA;
    if (b.totalImps !== a.totalImps) return b.totalImps - a.totalImps;
    return a.combinationId.localeCompare(b.combinationId);
  });
  const ranks = assignSharedRanks(
    rows.map((r) => r.averageImps ?? Number.NEGATIVE_INFINITY),
    config.sharedRanksOnTies !== false,
  );
  return rows.map((r, i) => ({ ...r, rank: ranks[i]! }));
}

export function aggregateCombinationRoundMatrix(
  credits: readonly CombinationImpCredit[],
): CombinationRoundCell[] {
  const map = new Map<string, { totalImps: number; boardsPlayed: number }>();
  for (const c of credits) {
    if (!c.roundId) continue;
    const key = `${c.combinationId}:${c.roundId}`;
    const cur = map.get(key) ?? { totalImps: 0, boardsPlayed: 0 };
    cur.totalImps += c.imps;
    cur.boardsPlayed += 1;
    map.set(key, cur);
  }
  return [...map.entries()].map(([key, v]) => {
    const [combinationId, roundId] = key.split(":");
    return {
      combinationId: combinationId!,
      roundId: roundId!,
      totalImps: v.totalImps,
      boardsPlayed: v.boardsPlayed,
    };
  });
}

/**
 * Player-level aggregation: each board IMP for a pair is credited to both players.
 */
export function aggregatePlayerStandings(
  credits: readonly BoardImpCredit[],
  pairPlayers: ReadonlyMap<string, PairPlayers>,
  config: AggregateConfig = {},
): PlayerStanding[] {
  const playerCredits: BoardImpCredit[] = [];
  for (const c of credits) {
    const players = pairPlayers.get(c.pairId);
    if (!players) continue;
    playerCredits.push({ pairId: players.player1Id, imps: c.imps });
    playerCredits.push({ pairId: players.player2Id, imps: c.imps });
  }
  // Reuse pair aggregator keyed by playerId
  const pairLike = aggregatePairStandings(playerCredits, config);
  return pairLike.map((p) => ({
    playerId: p.pairId,
    totalImps: p.totalImps,
    boardsPlayed: p.boardsPlayed,
    averageImps: p.averageImps,
    rank: p.rank,
  }));
}

/**
 * Score many boards and build pair (and optional player) standings.
 */
export function scoreAndAggregate(
  boards: readonly { results: readonly ButlerResultInput[] }[],
  options: {
    datumConfig?: DatumConfig;
    aggregateConfig?: AggregateConfig;
    pairPlayers?: ReadonlyMap<string, PairPlayers>;
  } = {},
): {
  boards: ButlerBoardOutput[];
  pairStandings: PairStanding[];
  playerStandings: PlayerStanding[] | null;
} {
  const boardOutputs = boards.map((b) =>
    scoreBoard(b.results, options.datumConfig),
  );
  const allCredits: BoardImpCredit[] = [];
  for (let i = 0; i < boards.length; i++) {
    allCredits.push(
      ...pairBoardCredits(boards[i]!.results, boardOutputs[i]!.results),
    );
  }
  const pairStandings = aggregatePairStandings(
    allCredits,
    options.aggregateConfig,
  );
  const playerStandings = options.pairPlayers
    ? aggregatePlayerStandings(
        allCredits,
        options.pairPlayers,
        options.aggregateConfig,
      )
    : null;
  return { boards: boardOutputs, pairStandings, playerStandings };
}
