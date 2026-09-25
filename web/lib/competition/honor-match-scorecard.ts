/**
 * Build a public honor match scorecard (open/closed rooms, home-perspective scores).
 * Used on /matches/[id] after the round is published.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchContext } from "@/lib/auth/match-access";
import { effectiveNsScoreForDatum } from "@/lib/butler/special-results";
import type {
  HonorDirection,
  HonorRoom,
  HonorVenueTables,
} from "@/lib/competition/honor-lineup";
import {
  hasAveragePmAward,
  parseAveragePmAwards,
} from "@/lib/results/adjustment-helpers";
import type {
  AverageAward,
  NonOffendingSide,
  WeightedScoreLeg,
} from "@/lib/results/types";
import { assignedMatchImpsFromRoomAwards } from "@/lib/scoring/honor-match-imps";
import type { MatchLineupEntry } from "@/lib/scoring/match-operations";
import { pointsToImps } from "@/lib/scoring/wbf-imp-table";
import {
  parseWeightedMatchMeta,
  weightedMatchImpsFromLegs,
  type WeightedRoomSide,
} from "@/lib/scoring/weighted-match-imps";
import type { Dealer, Vulnerability } from "@/lib/boards/types";

export type ScorecardContract = {
  contractLevel: number | null;
  contractDenomination: string | null;
  doubling: string;
  declarer: string | null;
  tricksResult: string | null;
};

export type ScorecardRoomCell = {
  /** Contract under the home (Thuis) column, if home declared. */
  homeContract: ScorecardContract | null;
  /** Contract under the away (Uit) column, if away declared. */
  awayContract: ScorecardContract | null;
  /** Home-perspective table score (open NS / closed −NS). */
  scoreHome: number | null;
  /** average_pm awards mapped to home/away columns for this room. */
  isAveragePm: boolean;
  averageHome: AverageAward | null;
  averageAway: AverageAward | null;
};

export type ScorecardBoardRow = {
  boardId: string;
  boardNumber: number;
  dealer: Dealer | null;
  vulnerability: Vulnerability | null;
  open: ScorecardRoomCell;
  closed: ScorecardRoomCell;
  /** Point swing from home perspective (openNs − closedNs). */
  deltaMp: number | null;
  impsHome: number;
  impsAway: number;
  kind: "compared" | "assigned" | "excluded";
};

export type ScorecardPairNames = {
  ns: string;
  ew: string;
};

export type HonorMatchScorecard = {
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  venueTables: HonorVenueTables | null;
  openPairs: ScorecardPairNames;
  closedPairs: ScorecardPairNames;
  boards: ScorecardBoardRow[];
  totals: {
    impsHome: number;
    impsAway: number;
    vpHome: number | null;
    vpAway: number | null;
  };
};

export type ScorecardResultInput = {
  boardId: string;
  boardNumber: number;
  dealer: Dealer | null;
  vulnerability: Vulnerability | null;
  room: "open" | "closed";
  contractLevel: number | null;
  contractDenomination: string | null;
  doubling: string;
  declarer: string | null;
  tricksResult: string | null;
  nsScore: number | null;
  computedScore: number | null;
  adminAdjustedNsScore: number | null;
  includedInMatchScore: boolean | null;
  adjustmentMode: string | null;
  adjustmentMeta: Record<string, unknown> | null;
};

/**
 * Open: NS = home. Closed: EW = home.
 * Returns which display column (home/away) should show the contract.
 */
export function contractColumnForRoom(
  room: "open" | "closed",
  declarer: string | null,
  denomination: string | null,
): "home" | "away" | null {
  if (denomination === "PASS") {
    // Pass-out: show under Thuis by convention.
    return "home";
  }
  if (declarer == null) return null;
  const nsDeclared = declarer === "N" || declarer === "S";
  const ewDeclared = declarer === "E" || declarer === "W";
  if (!nsDeclared && !ewDeclared) return null;

  if (room === "open") {
    // Home = NS, Away = EW
    return nsDeclared ? "home" : "away";
  }
  // Closed: Home = EW, Away = NS
  return ewDeclared ? "home" : "away";
}

export function homeScoreForRoom(
  room: "open" | "closed",
  nsScore: number,
): number {
  return room === "open" ? nsScore : -nsScore;
}

export function boardImpsFromDelta(deltaMp: number): {
  impsHome: number;
  impsAway: number;
} {
  const imps = pointsToImps(deltaMp);
  if (imps > 0) return { impsHome: imps, impsAway: 0 };
  if (imps < 0) return { impsHome: 0, impsAway: -imps };
  return { impsHome: 0, impsAway: 0 };
}

/** Map assigned awards to display IMPs (same credit rules as computeHonorMatchImps). */
export function displayImpsFromAssigned(entry: {
  homeImps: number;
  awayImps: number;
}): { impsHome: number; impsAway: number } {
  let impsHome = 0;
  let impsAway = 0;
  if (entry.homeImps > 0) impsHome += entry.homeImps;
  if (entry.awayImps > 0) impsAway += entry.awayImps;
  if (entry.homeImps < 0 && entry.awayImps === 0) {
    impsAway += -entry.homeImps;
  }
  if (entry.awayImps < 0 && entry.homeImps === 0) {
    impsHome += -entry.awayImps;
  }
  return { impsHome, impsAway };
}

function emptyRoomCell(): ScorecardRoomCell {
  return {
    homeContract: null,
    awayContract: null,
    scoreHome: null,
    isAveragePm: false,
    averageHome: null,
    averageAway: null,
  };
}

function toContract(row: ScorecardResultInput): ScorecardContract {
  return {
    contractLevel: row.contractLevel,
    contractDenomination: row.contractDenomination,
    doubling: row.doubling || "NONE",
    declarer: row.declarer,
    tricksResult: row.tricksResult,
  };
}

function placeContract(
  cell: ScorecardRoomCell,
  room: "open" | "closed",
  row: ScorecardResultInput,
): void {
  const column = contractColumnForRoom(
    room,
    row.declarer,
    row.contractDenomination,
  );
  if (column == null) return;
  const contract = toContract(row);
  if (column === "home") cell.homeContract = contract;
  else cell.awayContract = contract;
}

/** Map NS/EW awards onto home/away columns for the room. */
export function applyAveragePmToRoomCell(
  cell: ScorecardRoomCell,
  room: "open" | "closed",
  awards: { nsAward: AverageAward | null; ewAward: AverageAward | null },
): void {
  cell.isAveragePm = true;
  cell.homeContract = null;
  cell.awayContract = null;
  cell.scoreHome = null;
  if (room === "open") {
    // Home = NS, Away = EW
    cell.averageHome = awards.nsAward;
    cell.averageAway = awards.ewAward;
  } else {
    // Home = EW, Away = NS
    cell.averageHome = awards.ewAward;
    cell.averageAway = awards.nsAward;
  }
}

type BoardAcc = {
  boardId: string;
  boardNumber: number;
  dealer: Dealer | null;
  vulnerability: Vulnerability | null;
  open: ScorecardRoomCell;
  closed: ScorecardRoomCell;
  openNs: number | null;
  closedNs: number | null;
  openIncluded: boolean;
  closedIncluded: boolean;
  openHasAverage: boolean;
  closedHasAverage: boolean;
  openNsAward: AverageAward | null;
  openEwAward: AverageAward | null;
  closedNsAward: AverageAward | null;
  closedEwAward: AverageAward | null;
  openWeighted: boolean;
  closedWeighted: boolean;
  openLegs: WeightedScoreLeg[] | null;
  closedLegs: WeightedScoreLeg[] | null;
  openNop: NonOffendingSide | null;
  closedNop: NonOffendingSide | null;
  openOverride: { homeImps: number; awayImps: number } | null;
  closedOverride: { homeImps: number; awayImps: number } | null;
  seenOpen: boolean;
  seenClosed: boolean;
};

/**
 * Pure builder: pair open/closed results into scorecard board rows.
 * Boards with no usable IMP contribution are still listed when present.
 */
export function buildScorecardBoardRows(
  rows: ScorecardResultInput[],
): ScorecardBoardRow[] {
  const byBoard = new Map<string, BoardAcc>();

  for (const row of rows) {
    if (row.room !== "open" && row.room !== "closed") continue;

    const included = row.includedInMatchScore !== false;
    const isAveragePm = row.adjustmentMode === "average_pm";
    const isWeighted = row.adjustmentMode === "weighted";
    const awards = isAveragePm
      ? parseAveragePmAwards(row.adjustmentMeta)
      : { nsAward: null, ewAward: null };
    const hasAverage = isAveragePm && hasAveragePmAward(row.adjustmentMeta);
    const weightedMeta = isWeighted
      ? parseWeightedMatchMeta(row.adjustmentMeta)
      : null;

    const entry = byBoard.get(row.boardId) ?? {
      boardId: row.boardId,
      boardNumber: row.boardNumber,
      dealer: row.dealer,
      vulnerability: row.vulnerability,
      open: emptyRoomCell(),
      closed: emptyRoomCell(),
      openNs: null,
      closedNs: null,
      openIncluded: true,
      closedIncluded: true,
      openHasAverage: false,
      closedHasAverage: false,
      openNsAward: null,
      openEwAward: null,
      closedNsAward: null,
      closedEwAward: null,
      openWeighted: false,
      closedWeighted: false,
      openLegs: null,
      closedLegs: null,
      openNop: null,
      closedNop: null,
      openOverride: null,
      closedOverride: null,
      seenOpen: false,
      seenClosed: false,
    };

    const cell = row.room === "open" ? entry.open : entry.closed;
    if (!hasAverage) {
      placeContract(cell, row.room, row);
    }

    if (row.room === "open") {
      entry.seenOpen = true;
      if (hasAverage) {
        entry.openHasAverage = true;
        entry.openNsAward = awards.nsAward;
        entry.openEwAward = awards.ewAward;
        applyAveragePmToRoomCell(cell, "open", awards);
      }
      if (isWeighted && weightedMeta) {
        entry.openWeighted = true;
        entry.openLegs = weightedMeta.legs;
        entry.openNop = weightedMeta.nonOffendingSide;
        entry.openOverride = weightedMeta.matchImpsOverride;
      }
      if (!included && !hasAverage && !isWeighted) {
        entry.openIncluded = false;
        byBoard.set(row.boardId, entry);
        continue;
      }
      if (hasAverage) {
        byBoard.set(row.boardId, entry);
        continue;
      }
    } else {
      entry.seenClosed = true;
      if (hasAverage) {
        entry.closedHasAverage = true;
        entry.closedNsAward = awards.nsAward;
        entry.closedEwAward = awards.ewAward;
        applyAveragePmToRoomCell(cell, "closed", awards);
      }
      if (isWeighted && weightedMeta) {
        entry.closedWeighted = true;
        entry.closedLegs = weightedMeta.legs;
        entry.closedNop = weightedMeta.nonOffendingSide;
        entry.closedOverride = weightedMeta.matchImpsOverride;
      }
      if (!included && !hasAverage && !isWeighted) {
        entry.closedIncluded = false;
        byBoard.set(row.boardId, entry);
        continue;
      }
      if (hasAverage) {
        byBoard.set(row.boardId, entry);
        continue;
      }
    }

    const ns = effectiveNsScoreForDatum({
      adminAdjustedNsScore: row.adminAdjustedNsScore,
      nsScore: row.nsScore,
      computedScore: row.computedScore,
    });
    if (ns != null) {
      if (row.room === "open") {
        entry.openNs = ns;
        entry.open.scoreHome = homeScoreForRoom("open", ns);
      } else {
        entry.closedNs = ns;
        entry.closed.scoreHome = homeScoreForRoom("closed", ns);
      }
    }

    byBoard.set(row.boardId, entry);
  }

  const boards: ScorecardBoardRow[] = [];
  for (const entry of byBoard.values()) {
    if (entry.openHasAverage || entry.closedHasAverage) {
      const assigned = assignedMatchImpsFromRoomAwards({
        openNs: entry.openNsAward,
        openEw: entry.openEwAward,
        closedNs: entry.closedNsAward,
        closedEw: entry.closedEwAward,
      });
      const display = displayImpsFromAssigned(assigned);
      boards.push({
        boardId: entry.boardId,
        boardNumber: entry.boardNumber,
        dealer: entry.dealer,
        vulnerability: entry.vulnerability,
        open: entry.open,
        closed: entry.closed,
        deltaMp: null,
        impsHome: display.impsHome,
        impsAway: display.impsAway,
        kind: "assigned",
      });
      continue;
    }

    if (entry.openWeighted || entry.closedWeighted) {
      if (!entry.openIncluded || !entry.closedIncluded) {
        boards.push({
          boardId: entry.boardId,
          boardNumber: entry.boardNumber,
          dealer: entry.dealer,
          vulnerability: entry.vulnerability,
          open: entry.open,
          closed: entry.closed,
          deltaMp: null,
          impsHome: 0,
          impsAway: 0,
          kind: "excluded",
        });
        continue;
      }

      const override = entry.openOverride ?? entry.closedOverride;
      if (override) {
        const display = displayImpsFromAssigned(override);
        boards.push({
          boardId: entry.boardId,
          boardNumber: entry.boardNumber,
          dealer: entry.dealer,
          vulnerability: entry.vulnerability,
          open: entry.open,
          closed: entry.closed,
          deltaMp: null,
          impsHome: display.impsHome,
          impsAway: display.impsAway,
          kind: "assigned",
        });
        continue;
      }

      const openSide: WeightedRoomSide | { nsScore: number } | null =
        entry.openWeighted
          ? entry.openLegs
            ? {
                legs: entry.openLegs,
                nonOffendingSide: entry.openNop,
              }
            : null
          : entry.openNs != null
            ? { nsScore: entry.openNs }
            : null;
      const closedSide: WeightedRoomSide | { nsScore: number } | null =
        entry.closedWeighted
          ? entry.closedLegs
            ? {
                legs: entry.closedLegs,
                nonOffendingSide: entry.closedNop,
              }
            : null
          : entry.closedNs != null
            ? { nsScore: entry.closedNs }
            : null;

      if (openSide == null || closedSide == null) {
        boards.push({
          boardId: entry.boardId,
          boardNumber: entry.boardNumber,
          dealer: entry.dealer,
          vulnerability: entry.vulnerability,
          open: entry.open,
          closed: entry.closed,
          deltaMp: null,
          impsHome: 0,
          impsAway: 0,
          kind: "excluded",
        });
        continue;
      }

      try {
        const assigned = weightedMatchImpsFromLegs({
          open: openSide,
          closed: closedSide,
        });
        const display = displayImpsFromAssigned(assigned);
        boards.push({
          boardId: entry.boardId,
          boardNumber: entry.boardNumber,
          dealer: entry.dealer,
          vulnerability: entry.vulnerability,
          open: entry.open,
          closed: entry.closed,
          deltaMp: null,
          impsHome: display.impsHome,
          impsAway: display.impsAway,
          kind: "assigned",
        });
      } catch {
        boards.push({
          boardId: entry.boardId,
          boardNumber: entry.boardNumber,
          dealer: entry.dealer,
          vulnerability: entry.vulnerability,
          open: entry.open,
          closed: entry.closed,
          deltaMp: null,
          impsHome: 0,
          impsAway: 0,
          kind: "excluded",
        });
      }
      continue;
    }

    if (!entry.openIncluded || !entry.closedIncluded) {
      boards.push({
        boardId: entry.boardId,
        boardNumber: entry.boardNumber,
        dealer: entry.dealer,
        vulnerability: entry.vulnerability,
        open: entry.open,
        closed: entry.closed,
        deltaMp: null,
        impsHome: 0,
        impsAway: 0,
        kind: "excluded",
      });
      continue;
    }

    if (entry.openNs == null || entry.closedNs == null) {
      boards.push({
        boardId: entry.boardId,
        boardNumber: entry.boardNumber,
        dealer: entry.dealer,
        vulnerability: entry.vulnerability,
        open: entry.open,
        closed: entry.closed,
        deltaMp: null,
        impsHome: 0,
        impsAway: 0,
        kind: "excluded",
      });
      continue;
    }

    const deltaMp = entry.openNs - entry.closedNs;
    const { impsHome, impsAway } = boardImpsFromDelta(deltaMp);
    boards.push({
      boardId: entry.boardId,
      boardNumber: entry.boardNumber,
      dealer: entry.dealer,
      vulnerability: entry.vulnerability,
      open: entry.open,
      closed: entry.closed,
      deltaMp,
      impsHome,
      impsAway,
      kind: "compared",
    });
  }

  boards.sort((a, b) => a.boardNumber - b.boardNumber);
  return boards;
}

export function pairNamesFromLineup(
  lineup: MatchLineupEntry[],
  room: HonorRoom,
): ScorecardPairNames {
  const inRoom = lineup.filter((p) => p.room === room);
  const nameAt = (dir: HonorDirection): string => {
    const seat = inRoom.find((p) => p.direction === dir);
    return seat?.player?.name?.trim() || "—";
  };
  return {
    ns: `${nameAt("N")} & ${nameAt("S")}`,
    ew: `${nameAt("E")} & ${nameAt("W")}`,
  };
}

type DbResultRow = {
  board_id: string;
  room: string;
  contract_level: number | null;
  contract_denomination: string | null;
  doubling: string | null;
  declarer: string | null;
  tricks_result: string | null;
  ns_score: number | null;
  computed_score: number | null;
  admin_adjusted_ns_score: number | null;
  included_in_match_score: boolean | null;
  adjustment_mode: string | null;
  adjustment_meta: Record<string, unknown> | null;
  board:
    | {
        board_number: number;
        dealer: string | null;
        vulnerability: string | null;
        publication_status: string;
      }
    | {
        board_number: number;
        dealer: string | null;
        vulnerability: string | null;
        publication_status: string;
      }[]
    | null;
};

function unwrapBoard(board: DbResultRow["board"]): {
  board_number: number;
  dealer: string | null;
  vulnerability: string | null;
  publication_status: string;
} | null {
  if (board == null) return null;
  if (Array.isArray(board)) return board[0] ?? null;
  return board;
}

/**
 * Load published honor scorecard for a match, or null if nothing published yet.
 */
export async function loadHonorMatchScorecard(
  supabase: SupabaseClient,
  match: MatchContext,
  lineup: MatchLineupEntry[],
  venueTables: HonorVenueTables | null,
): Promise<HonorMatchScorecard | null> {
  if (match.imps_home == null || match.imps_away == null) {
    return null;
  }

  const { data, error } = await supabase
    .from("honor_board_results")
    .select(
      `
      board_id,
      room,
      contract_level,
      contract_denomination,
      doubling,
      declarer,
      tricks_result,
      ns_score,
      computed_score,
      admin_adjusted_ns_score,
      included_in_match_score,
      adjustment_mode,
      adjustment_meta,
      board:honor_boards!inner(
        board_number,
        dealer,
        vulnerability,
        publication_status
      )
    `,
    )
    .eq("match_id", match.id)
    .eq("processing_status", "published");

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const inputs: ScorecardResultInput[] = [];
  for (const raw of data as unknown as DbResultRow[]) {
    if (raw.room !== "open" && raw.room !== "closed") continue;
    const board = unwrapBoard(raw.board);
    if (!board || board.publication_status !== "published") continue;

    inputs.push({
      boardId: raw.board_id,
      boardNumber: board.board_number,
      dealer: (board.dealer as Dealer | null) ?? null,
      vulnerability: (board.vulnerability as Vulnerability | null) ?? null,
      room: raw.room,
      contractLevel: raw.contract_level,
      contractDenomination: raw.contract_denomination,
      doubling: raw.doubling ?? "NONE",
      declarer: raw.declarer,
      tricksResult: raw.tricks_result,
      nsScore: raw.ns_score,
      computedScore: raw.computed_score,
      adminAdjustedNsScore: raw.admin_adjusted_ns_score,
      includedInMatchScore: raw.included_in_match_score,
      adjustmentMode: raw.adjustment_mode,
      adjustmentMeta: raw.adjustment_meta,
    });
  }

  if (inputs.length === 0) return null;

  const boards = buildScorecardBoardRows(inputs);

  return {
    round: match.round,
    homeTeamName: match.home_team.name,
    awayTeamName: match.away_team.name,
    venueTables,
    openPairs: pairNamesFromLineup(lineup, "open"),
    closedPairs: pairNamesFromLineup(lineup, "closed"),
    boards,
    totals: {
      impsHome: match.imps_home,
      impsAway: match.imps_away,
      vpHome: match.vp_home,
      vpAway: match.vp_away,
    },
  };
}
