/** Honor Division seated lineup rules (Bladen Round Robin Excel forms). */

import {
  getRbbfRoundPairingsForCount,
  RBBF_TEAMS_REQUIRED,
  type SlotPairing,
} from "@/lib/scheduling/rbbf-8-team-template";

export type HonorRoom = "open" | "closed";
export type HonorDirection = "N" | "S" | "E" | "W";
export type HonorSide = "home" | "away";
export type HonorLineupPhase = "sequential" | "blind";

export type HonorSeatSlot = {
  room: HonorRoom;
  direction: HonorDirection;
};

/** Home: Open N/S + Closed E/W. Away: Open E/W + Closed N/S. */
export const HONOR_HOME_SEATS: readonly HonorSeatSlot[] = [
  { room: "open", direction: "N" },
  { room: "open", direction: "S" },
  { room: "closed", direction: "E" },
  { room: "closed", direction: "W" },
] as const;

export const HONOR_AWAY_SEATS: readonly HonorSeatSlot[] = [
  { room: "open", direction: "E" },
  { room: "open", direction: "W" },
  { room: "closed", direction: "N" },
  { room: "closed", direction: "S" },
] as const;

export function honorSeatSlots(side: HonorSide): readonly HonorSeatSlot[] {
  return side === "home" ? HONOR_HOME_SEATS : HONOR_AWAY_SEATS;
}

export function seatKey(slot: HonorSeatSlot): string {
  return `${slot.room}:${slot.direction}`;
}

export function isAllowedHonorSeat(
  side: HonorSide,
  room: HonorRoom,
  direction: HonorDirection,
): boolean {
  return honorSeatSlots(side).some(
    (s) => s.room === room && s.direction === direction,
  );
}

/**
 * Rounds 1..(2*roundsPerRr) are sequential (away first);
 * later rounds (RR3) are blind.
 */
export function honorLineupPhase(
  round: number,
  roundsPerRr: number,
): HonorLineupPhase {
  if (roundsPerRr <= 0) return "sequential";
  return round > roundsPerRr * 2 ? "blind" : "sequential";
}

export function roundsPerRoundRobin(
  roundCount: number,
  roundRobinCount: number,
): number {
  if (roundRobinCount <= 0) return roundCount;
  return Math.floor(roundCount / roundRobinCount);
}

export type HonorLockState = {
  homeLocked: boolean;
  awayLocked: boolean;
};

export function canEditHonorSide(options: {
  side: HonorSide;
  phase: HonorLineupPhase;
  homeLocked: boolean;
  awayLocked: boolean;
  isManager: boolean;
  played: boolean;
}): boolean {
  if (options.played) return false;

  const sideLocked =
    options.side === "home" ? options.homeLocked : options.awayLocked;
  if (sideLocked) return false;

  if (options.isManager) return true;

  if (options.phase === "sequential") {
    if (options.side === "home" && !options.awayLocked) return false;
  }

  return true;
}

export function canViewOpponentLineup(options: {
  viewerSide: HonorSide | "manager" | "other";
  phase: HonorLineupPhase;
  homeLocked: boolean;
  awayLocked: boolean;
}): boolean {
  if (options.viewerSide === "manager") return true;
  if (options.viewerSide === "other") {
    return options.homeLocked && options.awayLocked;
  }

  if (options.phase === "sequential") {
    // Home sees away after away locks; away does not need home to choose.
    if (options.viewerSide === "home") return options.awayLocked;
    return options.homeLocked && options.awayLocked;
  }

  // Blind: neither sees the other until both locked.
  return options.homeLocked && options.awayLocked;
}

export function canLockHonorSide(options: {
  side: HonorSide;
  phase: HonorLineupPhase;
  homeLocked: boolean;
  awayLocked: boolean;
  isManager: boolean;
  played: boolean;
  seatsComplete: boolean;
}): boolean {
  if (options.played) return false;
  if (!options.seatsComplete) return false;

  const sideLocked =
    options.side === "home" ? options.homeLocked : options.awayLocked;
  if (sideLocked) return false;

  if (options.isManager) return true;

  if (options.phase === "sequential" && options.side === "home") {
    return options.awayLocked;
  }

  return true;
}

export type SeatedLineupRow = {
  player_id: string;
  room: HonorRoom | null;
  direction: HonorDirection | null;
};

export function isHonorSeatedLineupComplete(
  rows: SeatedLineupRow[],
  side: HonorSide,
): boolean {
  const slots = honorSeatSlots(side);
  const seated = rows.filter((r) => r.room != null && r.direction != null);
  if (seated.length !== slots.length) return false;

  const playerIds = new Set(seated.map((r) => r.player_id));
  if (playerIds.size !== seated.length) return false;

  const filled = new Set(
    seated.map((r) => seatKey({ room: r.room!, direction: r.direction! })),
  );
  return slots.every((s) => filled.has(seatKey(s)));
}

export type HonorVenueTables = {
  openTable: number;
  closedTable: number;
};

/**
 * Excel assigns match slots in RBBF pairing order within the round:
 * index 0 → tables 1–2, 1 → 3–4, 2 → 5–6, 3 → 7–8.
 */
export function venueTablesForHonorMatch(options: {
  round: number;
  roundCount: number;
  homeSlot: number | null;
  awaySlot: number | null;
}): HonorVenueTables | null {
  const { round, roundCount, homeSlot, awaySlot } = options;
  if (
    homeSlot == null ||
    awaySlot == null ||
    homeSlot < 1 ||
    homeSlot > RBBF_TEAMS_REQUIRED ||
    awaySlot < 1 ||
    awaySlot > RBBF_TEAMS_REQUIRED
  ) {
    return null;
  }

  let pairings: SlotPairing[];
  try {
    const all = getRbbfRoundPairingsForCount(roundCount);
    pairings = all[round - 1] ?? [];
  } catch {
    return null;
  }

  const index = pairings.findIndex(
    (p) =>
      (p.home === homeSlot && p.away === awaySlot) ||
      (p.home === awaySlot && p.away === homeSlot),
  );
  if (index < 0) return null;

  return {
    openTable: index * 2 + 1,
    closedTable: index * 2 + 2,
  };
}
