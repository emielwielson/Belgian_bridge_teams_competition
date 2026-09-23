/**
 * Map Honor Division seated lineups to a BCS .bws session plan.
 *
 * Pair numbers: scheduleSlot * 10 + 1 (open room) / + 2 (closed room).
 * Open table: home NS vs away EW; closed: away NS vs home EW.
 */

import {
  buildBwsSession,
  type BwsSessionInput,
  type BwsSessionPairInput,
  type BwsSessionPlan,
  type BwsSessionResult,
} from "@/lib/bridgemate/bws-session";
import {
  honorBwsNameSettings,
  playerNumbersFromHonorMatches,
} from "@/lib/bridgemate/honor-bws-player-numbers";
import { writeBwsFromPlan } from "@/lib/bridgemate/write-bws";
import type { HonorRoundMatchSeating } from "@/lib/competition/honor-seating-overview";

const SECTION = "A";

export function bridgematePairNumber(
  scheduleSlot: number,
  roomPair: 1 | 2,
): number {
  return scheduleSlot * 10 + roomPair;
}

export function honorMatchReadyForBws(match: HonorRoundMatchSeating): string[] {
  const label = `${match.home_team.name} vs ${match.away_team.name}`;
  const errors: string[] = [];

  if (match.venue_tables == null) {
    errors.push(`${label}: venue tables ontbreken.`);
  }
  if (match.home_slot == null || match.away_slot == null) {
    errors.push(`${label}: schema-slot ontbreekt.`);
  }
  if (match.lock_status !== "both") {
    errors.push(`${label}: niet beide line-ups zijn vastgelegd.`);
  }
  if (!match.home_seats_complete || !match.away_seats_complete) {
    errors.push(`${label}: zitplaatsen zijn niet volledig.`);
  }
  if (!Number.isInteger(match.board_count) || match.board_count < 1) {
    errors.push(`${label}: ongeldig aantal spellen.`);
  }

  return errors;
}

export function honorRoundReadyForBws(
  matches: HonorRoundMatchSeating[],
): string[] {
  if (!matches.length) {
    return ["Deze ronde heeft geen wedstrijden."];
  }
  return matches.flatMap(honorMatchReadyForBws);
}

export function buildHonorBwsSessionInput(
  tournamentRoundNumber: number,
  matches: HonorRoundMatchSeating[],
): { ok: true; input: BwsSessionInput } | { ok: false; errors: string[] } {
  const errors = honorRoundReadyForBws(matches);
  if (errors.length) return { ok: false, errors };

  const sorted = [...matches].sort((a, b) => {
    const ao = a.venue_tables!.openTable;
    const bo = b.venue_tables!.openTable;
    return ao - bo;
  });

  const pairs: BwsSessionPairInput[] = [];
  const pairIds = new Set<string>();

  function ensurePair(id: string, number: number) {
    if (pairIds.has(id)) return;
    pairIds.add(id);
    pairs.push({ id, bridgematePairNumber: number });
  }

  const sessionMatches = sorted.map((match) => {
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

    return {
      id: match.match_id,
      boardCount: match.board_count,
      tables: [
        {
          id: `${match.match_id}:open`,
          bridgemateSection: SECTION,
          bridgemateTable: openTable,
          nsPairId: homeOpenId,
          ewPairId: awayOpenId,
        },
        {
          id: `${match.match_id}:closed`,
          bridgemateSection: SECTION,
          bridgemateTable: closedTable,
          nsPairId: awayClosedId,
          ewPairId: homeClosedId,
        },
      ],
    };
  });

  return {
    ok: true,
    input: {
      tournamentRoundNumber,
      sessionName: `Honneur ronde ${tournamentRoundNumber}`,
      matches: sessionMatches,
      pairs,
    },
  };
}

export type HonorBwsExportResult =
  | { ok: true; plan: BwsSessionPlan; buffer: Buffer }
  | { ok: false; errors: string[] };

export function exportHonorRoundBws(
  tournamentRoundNumber: number,
  matches: HonorRoundMatchSeating[],
  options?: { guid?: string; template?: Buffer; now?: Date },
): HonorBwsExportResult {
  const builtInput = buildHonorBwsSessionInput(tournamentRoundNumber, matches);
  if (!builtInput.ok) return builtInput;

  const built: BwsSessionResult = buildBwsSession(builtInput.input, {
    guid: options?.guid,
  });
  if (!built.ok) return built;

  const plan: BwsSessionPlan = {
    ...built.plan,
    playerNumbers: playerNumbersFromHonorMatches(matches),
    settings: [honorBwsNameSettings()],
  };

  try {
    const buffer = writeBwsFromPlan(
      plan,
      options?.template,
      options?.now,
    );
    return { ok: true, plan, buffer };
  } catch (e) {
    return {
      ok: false,
      errors: [
        e instanceof Error ? e.message : "Kon .bws niet genereren.",
      ],
    };
  }
}
