import { describe, expect, it } from "vitest";
import {
  getRbbfRoundPairings,
  getRbbfTripleRoundPairings,
  RBBF_FIRST_LEG,
  RBBF_ROUND_COUNT,
  RBBF_TEAMS_REQUIRED,
  RBBF_TRIPLE_ROUND_COUNT,
} from "./rbbf-8-team-template";
import { assignTeamSlots, buildMatchRows } from "./generate-group-schedule";

describe("rbbf-8-team-template", () => {
  it("has 14 rounds with 4 fixtures each", () => {
    const rounds = getRbbfRoundPairings();
    expect(rounds).toHaveLength(RBBF_ROUND_COUNT);
    for (const round of rounds) {
      expect(round).toHaveLength(4);
    }
  });

  it("mirrors rounds 8-14 from first leg with swapped home/away", () => {
    const rounds = getRbbfRoundPairings();
    for (let i = 0; i < 7; i++) {
      const first = RBBF_FIRST_LEG[i];
      const mirror = rounds[i + 7];
      expect(mirror).toEqual(
        first.map((p) => ({ home: p.away, away: p.home })),
      );
    }
  });

  it("triple schedule has 21 rounds (84 fixtures)", () => {
    const rounds = getRbbfTripleRoundPairings();
    expect(rounds).toHaveLength(RBBF_TRIPLE_ROUND_COUNT);
    expect(rounds.reduce((n, r) => n + r.length, 0)).toBe(84);
  });

  it("builds 56 matches for 8 teams", () => {
    const teamIds = Array.from({ length: RBBF_TEAMS_REQUIRED }, (_, i) =>
      `team-${i + 1}`,
    );
    const teams = assignTeamSlots(teamIds);
    const dates = Array.from({ length: 14 }, (_, i) => ({
      round: i + 1,
      datetime: new Date(Date.UTC(2025, 8, i + 1, 14, 0)).toISOString(),
    }));
    const matches = buildMatchRows("group-1", teams, dates, 24);
    expect(matches).toHaveLength(56);
    expect(new Set(matches.map((m) => m.round)).size).toBe(14);
  });
});
