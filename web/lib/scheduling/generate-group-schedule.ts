import {
  getRbbfRoundPairings,
  mapSlotsToTeamIds,
  RBBF_ROUND_COUNT,
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

export function assignTeamSlots(
  teamIds: string[],
): TeamSlot[] {
  if (teamIds.length !== RBBF_TEAMS_REQUIRED) {
    throw new Error(`RBBF schedule requires ${RBBF_TEAMS_REQUIRED} teams`);
  }
  return teamIds.map((id, index) => ({ id, slot: index + 1 }));
}

export function buildMatchRows(
  groupId: string,
  teams: TeamSlot[],
  roundDates: RoundDate[],
  boardCount: number,
): GeneratedMatch[] {
  if (roundDates.length < RBBF_ROUND_COUNT) {
    throw new Error(`Need ${RBBF_ROUND_COUNT} round datetimes`);
  }

  const slotToTeamId = new Map(teams.map((t) => [t.slot, t.id]));
  const dateByRound = new Map(roundDates.map((d) => [d.round, d.datetime]));
  const allRounds = getRbbfRoundPairings();
  const matches: GeneratedMatch[] = [];

  allRounds.forEach((pairings: SlotPairing[], index) => {
    const round = index + 1;
    const datetime = dateByRound.get(round);
    if (!datetime) {
      throw new Error(`Missing datetime for round ${round}`);
    }
    const fixtures = mapSlotsToTeamIds(pairings, slotToTeamId);
    for (const f of fixtures) {
      matches.push({
        group_id: groupId,
        round,
        datetime,
        home_team_id: f.homeTeamId,
        away_team_id: f.awayTeamId,
        board_count: boardCount,
      });
    }
  });

  return matches;
}
