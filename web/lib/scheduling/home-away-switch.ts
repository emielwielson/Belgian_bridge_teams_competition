/** RBBF mirror-leg home/away switch eligibility (PRD FR 51, rounds 8–14). */

export const RBBF_MIRROR_ROUND_MIN = 8;
export const RBBF_MIRROR_ROUND_MAX = 14;
export const RBBF_TEAMS_FOR_SWITCH = 8;

export type FixtureSides = {
  homeTeamId: string;
  awayTeamId: string;
};

export function isRbbfGroupRoundCount(roundCount: number): boolean {
  return roundCount === 14 || roundCount === 21;
}

export function isRbbfMirrorRound(round: number, groupRoundCount: number): boolean {
  if (!isRbbfGroupRoundCount(groupRoundCount)) return false;
  return round >= RBBF_MIRROR_ROUND_MIN && round <= RBBF_MIRROR_ROUND_MAX;
}

export function firstLegRoundForMirror(mirrorRound: number): number {
  return mirrorRound - 7;
}

export function sameFixtureTeamPair(
  aHome: string,
  aAway: string,
  bHome: string,
  bAway: string,
): boolean {
  return (
    (aHome === bHome && aAway === bAway) ||
    (aHome === bAway && aAway === bHome)
  );
}

/** True when return leg still has the same home/away as the first leg (swap needed). */
export function needsMirrorHomeAway(
  firstLeg: FixtureSides,
  current: FixtureSides,
): boolean {
  return (
    firstLeg.homeTeamId === current.homeTeamId &&
    firstLeg.awayTeamId === current.awayTeamId
  );
}

/** True when return leg already has mirrored home/away vs first leg. */
export function isMirroredHomeAway(
  firstLeg: FixtureSides,
  current: FixtureSides,
): boolean {
  return (
    firstLeg.homeTeamId === current.awayTeamId &&
    firstLeg.awayTeamId === current.homeTeamId
  );
}

export function mirroredHomeAway(sides: FixtureSides): FixtureSides {
  return {
    homeTeamId: sides.awayTeamId,
    awayTeamId: sides.homeTeamId,
  };
}
