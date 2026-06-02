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
export const RBBF_TRIPLE_ROUND_COUNT = 21;
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

/** All 21 rounds: three full legs (triple round-robin). */
export function getRbbfTripleRoundPairings(): SlotPairing[][] {
  const rounds = getRbbfRoundPairings();
  for (const leg of RBBF_FIRST_LEG) {
    rounds.push(leg.map((p) => ({ ...p })));
  }
  return rounds;
}

/** RBBF template only supports 14 (double) or 21 (triple) fixture rounds. */
export function rbbfFixtureRoundCount(
  storedRoundCount: number,
  roundRobinCount: number,
  scope: "national" | "regional" = "national",
): number {
  if (scope === "regional") return RBBF_ROUND_COUNT;
  if (storedRoundCount === RBBF_ROUND_COUNT) return RBBF_ROUND_COUNT;
  if (storedRoundCount === RBBF_TRIPLE_ROUND_COUNT) return RBBF_TRIPLE_ROUND_COUNT;
  return roundRobinCount >= 3 ? RBBF_TRIPLE_ROUND_COUNT : RBBF_ROUND_COUNT;
}

export function getRbbfRoundPairingsForCount(roundCount: number): SlotPairing[][] {
  if (roundCount === RBBF_ROUND_COUNT) return getRbbfRoundPairings();
  if (roundCount === RBBF_TRIPLE_ROUND_COUNT) return getRbbfTripleRoundPairings();
  throw new Error(`Unsupported round count: ${roundCount}`);
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
