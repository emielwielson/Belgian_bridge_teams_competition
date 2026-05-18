/** PRD appendix §10 — mirrored in web/lib/scheduling/rbbf-8-team-template.ts */

export type SlotPairing = { home: number; away: number };

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

export function getRbbfRoundPairings(): SlotPairing[][] {
  const rounds = RBBF_FIRST_LEG.map((r) => r.map((p) => ({ ...p })));
  for (const leg of RBBF_FIRST_LEG) {
    rounds.push(leg.map((p) => ({ home: p.away, away: p.home })));
  }
  return rounds;
}

export function getRbbfTripleRoundPairings(): SlotPairing[][] {
  const rounds = getRbbfRoundPairings();
  for (const leg of RBBF_FIRST_LEG) {
    rounds.push(leg.map((p) => ({ ...p })));
  }
  return rounds;
}

export function getRbbfRoundPairingsForCount(roundCount: number): SlotPairing[][] {
  if (roundCount === 14) return getRbbfRoundPairings();
  if (roundCount === 21) return getRbbfTripleRoundPairings();
  throw new Error(`Unsupported round count: ${roundCount}`);
}
