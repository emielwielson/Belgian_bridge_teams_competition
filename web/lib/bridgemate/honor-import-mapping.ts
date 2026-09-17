/**
 * Build Bridgemate mapping context from Honor seating (same numbering as .bws export).
 */

import {
  bridgematePairNumber,
  honorRoundReadyForBws,
} from "@/lib/bridgemate/honor-bws-export";
import type { BridgemateMappingContext } from "@/lib/bridgemate/types";
import type { HonorRoundMatchSeating } from "@/lib/competition/honor-seating-overview";
import type { HonorDirection, HonorRoom } from "@/lib/competition/honor-lineup";

const SECTION = "A";

/**
 * BCS / Bridgemate sessions number boards 1..N for the sitting.
 * PBN (and honor_boards.board_number) may use absolute numbers (e.g. 17–32).
 * Map by ascending ordinal so Bridgemate board k → k-th board of the round.
 */
export function toBridgemateSessionBoards(
  boards: Array<{ id: string; boardNumber: number }>,
): Array<{ id: string; boardNumber: number }> {
  return [...boards]
    .sort((a, b) => a.boardNumber - b.boardNumber || a.id.localeCompare(b.id))
    .map((b, i) => ({ id: b.id, boardNumber: i + 1 }));
}

export type HonorMappedTable = BridgemateMappingContext["tables"][number] & {
  room: HonorRoom;
  nsPlayerIds: [string, string] | null;
  ewPlayerIds: [string, string] | null;
  nsTeamId: string | null;
  ewTeamId: string | null;
  nsNames: [string, string] | null;
  ewNames: [string, string] | null;
};

export type HonorMappingContext = Omit<BridgemateMappingContext, "tables"> & {
  tables: HonorMappedTable[];
};

function playersAt(
  match: HonorRoundMatchSeating,
  room: HonorRoom,
  dirs: HonorDirection[],
): {
  ids: [string, string] | null;
  names: [string, string] | null;
  teamId: string | null;
} {
  const seated = dirs.map((d) =>
    match.seats.find((s) => s.room === room && s.direction === d),
  );
  if (!seated[0] || !seated[1]) {
    return { ids: null, names: null, teamId: null };
  }
  return {
    ids: [seated[0].player_id, seated[1].player_id],
    names: [seated[0].name, seated[1].name],
    teamId: seated[0].team_id,
  };
}

/**
 * Map Honor round seating to Bridgemate table/pair context.
 * Table ids are `${matchId}:${room}` (open/closed).
 */
export function buildHonorMappingContext(
  tournamentRoundNumber: number,
  matches: HonorRoundMatchSeating[],
  boards: Array<{ id: string; boardNumber: number }>,
): { ok: true; ctx: HonorMappingContext } | { ok: false; errors: string[] } {
  const readyErrors = honorRoundReadyForBws(matches);
  if (readyErrors.length) return { ok: false, errors: readyErrors };
  if (!boards.length) {
    return {
      ok: false,
      errors: ["Geen borden voor deze ronde. Upload eerst de PBN."],
    };
  }

  const sorted = [...matches].sort((a, b) => {
    const ao = a.venue_tables!.openTable;
    const bo = b.venue_tables!.openTable;
    return ao - bo;
  });

  const pairs: BridgemateMappingContext["pairs"] = [];
  const pairIds = new Set<string>();

  function ensurePair(id: string, number: number) {
    if (pairIds.has(id)) return;
    pairIds.add(id);
    pairs.push({ id, bridgematePairNumber: number });
  }

  const tables: HonorMappedTable[] = [];

  for (const match of sorted) {
    const homeSlot = match.home_slot!;
    const awaySlot = match.away_slot!;
    const { openTable, closedTable } = match.venue_tables!;

    const homeOpenId = `pair:${match.home_team.id}:1`;
    const homeClosedId = `pair:${match.home_team.id}:2`;
    const awayOpenId = `pair:${match.away_team.id}:1`;
    const awayClosedId = `pair:${match.away_team.id}:2`;

    ensurePair(homeOpenId, bridgematePairNumber(homeSlot, 1));
    ensurePair(homeClosedId, bridgematePairNumber(homeSlot, 2));
    ensurePair(awayOpenId, bridgematePairNumber(awaySlot, 1));
    ensurePair(awayClosedId, bridgematePairNumber(awaySlot, 2));

    const openNs = playersAt(match, "open", ["N", "S"]);
    const openEw = playersAt(match, "open", ["E", "W"]);
    const closedNs = playersAt(match, "closed", ["N", "S"]);
    const closedEw = playersAt(match, "closed", ["E", "W"]);

    tables.push({
      id: `${match.match_id}:open`,
      matchId: match.match_id,
      bridgemateSection: SECTION,
      bridgemateTable: openTable,
      nsPairId: homeOpenId,
      ewPairId: awayOpenId,
      room: "open",
      nsPlayerIds: openNs.ids,
      ewPlayerIds: openEw.ids,
      nsTeamId: openNs.teamId,
      ewTeamId: openEw.teamId,
      nsNames: openNs.names,
      ewNames: openEw.names,
    });

    tables.push({
      id: `${match.match_id}:closed`,
      matchId: match.match_id,
      bridgemateSection: SECTION,
      bridgemateTable: closedTable,
      nsPairId: awayClosedId,
      ewPairId: homeClosedId,
      room: "closed",
      nsPlayerIds: closedNs.ids,
      ewPlayerIds: closedEw.ids,
      nsTeamId: closedNs.teamId,
      ewTeamId: closedEw.teamId,
      nsNames: closedNs.names,
      ewNames: closedEw.names,
    });
  }

  return {
    ok: true,
    ctx: {
      tournamentRoundNumber,
      expectedBridgemateRound: 1,
      tables,
      pairs,
      boards,
    },
  };
}
