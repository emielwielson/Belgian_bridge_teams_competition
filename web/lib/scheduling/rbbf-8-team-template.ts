/** PRD appendix §10: 8-team double round-robin (slots 1–8). */

export type SlotPairing = { home: number; away: number };

/** First leg rounds 1–7 (home-away as listed). */
export const RBBF_FIRST_LEG: SlotPairing[][] = [
  [
    { home: 1, away: 2 },
    { home: 3, away: 4 },
    { home: 5, away: 6 },
    { home: 7, away: 8 },
  ],
  [
    { home: 1, away: 6 },
    { home: 2, away: 5 },
    { home: 3, away: 8 },
    { home: 4, away: 7 },
  ],
  [
    { home: 7, away: 1 },
    { home: 6, away: 2 },
    { home: 5, away: 3 },
    { home: 8, away: 4 },
  ],
  [
    { home: 1, away: 8 },
    { home: 2, away: 7 },
    { home: 3, away: 6 },
    { home: 4, away: 5 },
  ],
  [
    { home: 5, away: 1 },
    { home: 8, away: 2 },
    { home: 7, away: 3 },
    { home: 6, away: 4 },
  ],
  [
    { home: 1, away: 3 },
    { home: 2, away: 4 },
    { home: 8, away: 6 },
    { home: 7, away: 5 },
  ],
  [
    { home: 4, away: 1 },
    { home: 3, away: 2 },
    { home: 5, away: 8 },
    { home: 6, away: 7 },
  ],
];

export const RBBF_ROUND_COUNT = 14;
export const RBBF_TEAMS_REQUIRED = 8;

function mirrorPairing(pair: SlotPairing): SlotPairing {
  return { home: pair.away, away: pair.home };
}

/** All 14 rounds: 1–7 first leg, 8–14 mirrored home/away. */
export function getRbbfRoundPairings(): SlotPairing[][] {
  const rounds: SlotPairing[][] = RBBF_FIRST_LEG.map((round) =>
    round.map((p) => ({ ...p })),
  );
  for (const leg of RBBF_FIRST_LEG) {
    rounds.push(leg.map(mirrorPairing));
  }
  return rounds;
}

export function mapSlotsToTeamIds(
  pairings: SlotPairing[],
  slotToTeamId: Map<number, string>,
): { homeTeamId: string; awayTeamId: string }[] {
  return pairings.map((p) => ({
    homeTeamId: slotToTeamId.get(p.home)!,
    awayTeamId: slotToTeamId.get(p.away)!,
  }));
}
