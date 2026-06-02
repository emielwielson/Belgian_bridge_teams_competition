import type { ScheduleSlotRow } from "@/lib/competition/group-schedule-slots";
import {
  getRbbfRoundPairingsForCount,
  RBBF_TEAMS_REQUIRED,
  type SlotPairing,
} from "./rbbf-8-team-template";

export type TeamSlot = { id: string; slot: number };

export type RoundDate = { round: number; datetime: string };

export type GeneratedMatch = {
  group_id: string;
  round: number;
  datetime: string;
  home_team_id: string;
  away_team_id: string;
  board_count: number;
};

export type RbbfScheduleResult = {
  matches: GeneratedMatch[];
  byes: { round: number; team_id: string }[];
};

export function assignTeamSlots(
  teamIds: string[],
): TeamSlot[] {
  if (teamIds.length !== RBBF_TEAMS_REQUIRED) {
    throw new Error(`RBBF schedule requires ${RBBF_TEAMS_REQUIRED} teams`);
  }
  return teamIds.map((id, index) => ({ id, slot: index + 1 }));
}

type SlotOccupant = { teamId: string | null; isBye: boolean };

function slotOccupantsFromAssignments(
  slotAssignments: ScheduleSlotRow[],
): Map<number, SlotOccupant> {
  const map = new Map<number, SlotOccupant>();
  for (const row of slotAssignments) {
    map.set(row.slot, {
      teamId: row.teamId,
      isBye: row.isBye,
    });
  }
  return map;
}

function slotOccupantsFromTeamSlots(
  teams: TeamSlot[],
): Map<number, SlotOccupant> {
  const map = new Map<number, SlotOccupant>();
  for (const team of teams) {
    map.set(team.slot, { teamId: team.id, isBye: false });
  }
  return map;
}

function resolvePairing(
  pairing: SlotPairing,
  occupants: Map<number, SlotOccupant>,
): { homeTeamId: string; awayTeamId: string } | { byeTeamId: string } | null {
  const home = occupants.get(pairing.home);
  const away = occupants.get(pairing.away);

  if (!home || !away) {
    throw new Error(`Missing slot assignment for pairing ${pairing.home}-${pairing.away}`);
  }

  const homeBye = home.isBye;
  const awayBye = away.isBye;

  if (!homeBye && !home.teamId) {
    throw new Error(`Slot ${pairing.home} is not assigned`);
  }
  if (!awayBye && !away.teamId) {
    throw new Error(`Slot ${pairing.away} is not assigned`);
  }

  if (homeBye && awayBye) {
    return null;
  }
  if (homeBye && away.teamId) {
    return { byeTeamId: away.teamId };
  }
  if (awayBye && home.teamId) {
    return { byeTeamId: home.teamId };
  }
  if (home.teamId && away.teamId) {
    return { homeTeamId: home.teamId, awayTeamId: away.teamId };
  }
  return null;
}

export function buildRbbfSchedule(
  groupId: string,
  slotAssignments: ScheduleSlotRow[] | TeamSlot[],
  roundDates: RoundDate[],
  boardCount: number,
  roundCount = 14,
): RbbfScheduleResult {
  if (roundDates.length < roundCount) {
    throw new Error(`Need ${roundCount} round datetimes`);
  }

  const occupants =
    slotAssignments.length > 0 && "isBye" in slotAssignments[0]
      ? slotOccupantsFromAssignments(slotAssignments as ScheduleSlotRow[])
      : slotOccupantsFromTeamSlots(slotAssignments as TeamSlot[]);

  const dateByRound = new Map(roundDates.map((d) => [d.round, d.datetime]));
  const allRounds = getRbbfRoundPairingsForCount(roundCount);
  const matches: GeneratedMatch[] = [];
  const byes: { round: number; team_id: string }[] = [];

  allRounds.forEach((pairings: SlotPairing[], index) => {
    const round = index + 1;
    const datetime = dateByRound.get(round);
    if (!datetime) {
      throw new Error(`Missing datetime for round ${round}`);
    }

    for (const pairing of pairings) {
      const result = resolvePairing(pairing, occupants);
      if (!result) continue;
      if ("byeTeamId" in result) {
        byes.push({ round, team_id: result.byeTeamId });
        continue;
      }
      matches.push({
        group_id: groupId,
        round,
        datetime,
        home_team_id: result.homeTeamId,
        away_team_id: result.awayTeamId,
        board_count: boardCount,
      });
    }
  });

  return { matches, byes };
}

export function buildMatchRows(
  groupId: string,
  teams: TeamSlot[],
  roundDates: RoundDate[],
  boardCount: number,
  roundCount = 14,
): GeneratedMatch[] {
  return buildRbbfSchedule(
    groupId,
    teams,
    roundDates,
    boardCount,
    roundCount,
  ).matches;
}
