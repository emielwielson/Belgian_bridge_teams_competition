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
  /**
   * EW-favorable score for datum (positive = good for EW).
   * When null, defaults to -nsScoreForDatum.
   */
  ewScoreForDatum?: number | null;
  adminNsButlerImps: number | null;
  /** When set with admin NS IMPs, used as independent EW award (legacy split IMPs). */
  adminEwButlerImps?: number | null;
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

function effectiveEwScoreForDatum(r: ButlerResultInput): number | null {
  if (r.ewScoreForDatum != null) return r.ewScoreForDatum;
  if (r.nsScoreForDatum != null) return -r.nsScoreForDatum;
  return null;
}

/**
 * Score one board's table results vs trimmed-mean datum (§4.8.1–4.8.2, §4.8.5).
 * When any result supplies an explicit EW score, NS and EW datums are independent;
 * otherwise EW datum = −NS datum (preserves asymmetric datum rounding).
 */
export function scoreBoard(
  results: readonly ButlerResultInput[],
  datumConfig: DatumConfig = {},
): ButlerBoardOutput {
  const nsDatumScores = results
    .filter((r) => r.includedInDatum && r.nsScoreForDatum != null)
    .map((r) => r.nsScoreForDatum as number);

  const hasExplicitEw = results.some(
    (r) => r.includedInDatum && r.ewScoreForDatum != null,
  );

  const nsDatumResult = computeNsDatum(nsDatumScores, datumConfig);
  const nsDatum = nsDatumResult.ok ? nsDatumResult.nsDatum : null;

  let ewDatum: number | null;
  let datumOk: boolean;

  if (hasExplicitEw) {
    const ewDatumScores = results
      .filter((r) => r.includedInDatum)
      .map((r) => effectiveEwScoreForDatum(r))
      .filter((s): s is number => s != null);
    const ewDatumResult = computeNsDatum(ewDatumScores, datumConfig);
    ewDatum = ewDatumResult.ok ? ewDatumResult.nsDatum : null;
    datumOk = nsDatumResult.ok && ewDatumResult.ok;
  } else {
    ewDatum = nsDatumResult.ok ? nsDatumResult.ewDatum : null;
    datumOk = nsDatumResult.ok;
  }

  const scored: ButlerBoardResult[] = results.map((r) => {
    if (r.adminNsButlerImps != null) {
      return {
        id: r.id,
        nsButlerImps: r.adminNsButlerImps,
        ewButlerImps:
          r.adminEwButlerImps != null
            ? r.adminEwButlerImps
            : -r.adminNsButlerImps,
        scoreDiff: null,
        usedAdminImps: true,
      };
    }

    const ewScore = effectiveEwScoreForDatum(r);

    // Automatic IMPs only for datum-included results (§4.8.5)
    if (
      r.includedInDatum &&
      nsDatum != null &&
      ewDatum != null &&
      r.nsScoreForDatum != null &&
      ewScore != null
    ) {
      const scoreDiff = r.nsScoreForDatum - nsDatum;
      const nsButlerImps = pointsToImps(scoreDiff);
      const ewButlerImps = hasExplicitEw
        ? pointsToImps(ewScore - ewDatum)
        : -nsButlerImps;
      return {
        id: r.id,
        nsButlerImps,
        ewButlerImps,
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
    datumOk,
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

export type PlayerImpCredit = {
  playerId: string;
  imps: number;
};

/**
 * Player standings ranked by average IMP (same rules as combination standings).
 * Callers expand pair/combination board credits to both players before passing in.
 */
export function aggregatePlayerStandingsByAverage(
  credits: readonly PlayerImpCredit[],
  config: AggregateConfig = {},
): PlayerStanding[] {
  const map = new Map<string, { totalImps: number; boardsPlayed: number }>();
  for (const c of credits) {
    const cur = map.get(c.playerId) ?? { totalImps: 0, boardsPlayed: 0 };
    cur.totalImps += c.imps;
    cur.boardsPlayed += 1;
    map.set(c.playerId, cur);
  }
  const rows = [...map.entries()].map(([playerId, v]) => ({
    playerId,
    totalImps: v.totalImps,
    boardsPlayed: v.boardsPlayed,
    averageImps: v.boardsPlayed > 0 ? v.totalImps / v.boardsPlayed : null,
  }));
  rows.sort((a, b) => {
    const avgA = a.averageImps ?? Number.NEGATIVE_INFINITY;
    const avgB = b.averageImps ?? Number.NEGATIVE_INFINITY;
    if (avgB !== avgA) return avgB - avgA;
    if (b.totalImps !== a.totalImps) return b.totalImps - a.totalImps;
    return a.playerId.localeCompare(b.playerId);
  });
  const ranks = assignSharedRanks(
    rows.map((r) => r.averageImps ?? Number.NEGATIVE_INFINITY),
    config.sharedRanksOnTies !== false,
  );
  return rows.map((r, i) => ({ ...r, rank: ranks[i]! }));
}

/**
 * Player-level aggregation: each board IMP for a pair is credited to both players.
 * Ranks by total IMP (legacy pair-style ranking).
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
