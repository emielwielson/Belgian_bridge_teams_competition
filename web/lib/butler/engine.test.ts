import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  aggregateCombinationStandings,
  aggregatePairStandings,
  aggregatePlayerStandings,
  assignSharedRanks,
  pairBoardCredits,
  scoreAndAggregate,
  scoreBoard,
  type ButlerResultInput,
} from "@/lib/butler/engine";

type GoldenFixture = {
  name: string;
  nsScores: number[];
  expectedNsDatum: number;
  expectedEwDatum: number;
  results: { id: string; nsScore: number; nsImps: number }[];
};

function loadFixture(name: string): GoldenFixture {
  const file = path.join(process.cwd(), "fixtures", "butler", `${name}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as GoldenFixture;
}

function inputsFromFixture(fx: GoldenFixture): ButlerResultInput[] {
  return fx.results.map((r) => ({
    id: r.id,
    nsPairId: `ns-${r.id}`,
    ewPairId: `ew-${r.id}`,
    includedInDatum: true,
    nsScoreForDatum: r.nsScore,
    adminNsButlerImps: null,
  }));
}

describe("scoreBoard golden fixtures §4.8.4", () => {
  for (const name of ["example-a", "example-b", "example-c"] as const) {
    it(`reproduces ${name}`, () => {
      const fx = loadFixture(name);
      const out = scoreBoard(inputsFromFixture(fx));
      expect(out.datumOk).toBe(true);
      expect(out.nsDatum).toBe(fx.expectedNsDatum);
      expect(out.ewDatum).toBe(fx.expectedEwDatum);
      for (const expected of fx.results) {
        const row = out.results.find((r) => r.id === expected.id);
        expect(row).toBeDefined();
        expect(row!.nsButlerImps).toBe(expected.nsImps);
        expect(row!.ewButlerImps).toBe(-expected.nsImps);
      }
    });
  }

  it("example A narrative: +90 vs datum 50 → +1 IMP (not −1)", () => {
    const fx = loadFixture("example-a");
    const out = scoreBoard(inputsFromFixture(fx));
    const row = out.results.find((r) => r.id === "a7");
    expect(row!.scoreDiff).toBe(40);
    expect(row!.nsButlerImps).toBe(1);
  });
});

describe("scoreBoard edge cases", () => {
  it("cannot compute datum when N < 3; no automatic IMPs", () => {
    const results: ButlerResultInput[] = [
      {
        id: "1",
        nsPairId: "p1",
        ewPairId: "p2",
        includedInDatum: true,
        nsScoreForDatum: 100,
        adminNsButlerImps: null,
      },
      {
        id: "2",
        nsPairId: "p3",
        ewPairId: "p4",
        includedInDatum: true,
        nsScoreForDatum: 200,
        adminNsButlerImps: null,
      },
    ];
    const out = scoreBoard(results);
    expect(out.datumOk).toBe(false);
    expect(out.nsDatum).toBeNull();
    expect(out.results.every((r) => r.nsButlerImps === null)).toBe(true);
  });

  it("excludes specials from datum and does not assign automatic IMPs", () => {
    // N=4 included (≥2 remain after k=1 trim); one special excluded
    const results: ButlerResultInput[] = [
      {
        id: "1",
        nsPairId: "a",
        ewPairId: "b",
        includedInDatum: true,
        nsScoreForDatum: 110,
        adminNsButlerImps: null,
      },
      {
        id: "2",
        nsPairId: "c",
        ewPairId: "d",
        includedInDatum: true,
        nsScoreForDatum: 80,
        adminNsButlerImps: null,
      },
      {
        id: "3",
        nsPairId: "e",
        ewPairId: "f",
        includedInDatum: true,
        nsScoreForDatum: 90,
        adminNsButlerImps: null,
      },
      {
        id: "4",
        nsPairId: "i",
        ewPairId: "j",
        includedInDatum: true,
        nsScoreForDatum: 70,
        adminNsButlerImps: null,
      },
      {
        id: "special",
        nsPairId: "g",
        ewPairId: "h",
        includedInDatum: false,
        nsScoreForDatum: 500,
        adminNsButlerImps: null,
      },
    ];
    const out = scoreBoard(results);
    expect(out.datumOk).toBe(true);
    // discard 110 and 70 → mean (80+90)/2 = 85 → datum 90
    expect(out.nsDatum).toBe(90);
    const special = out.results.find((r) => r.id === "special");
    expect(special!.nsButlerImps).toBeNull();
  });

  it("uses admin IMPs when set, even without datum inclusion", () => {
    const results: ButlerResultInput[] = [
      {
        id: "1",
        nsPairId: "a",
        ewPairId: "b",
        includedInDatum: false,
        nsScoreForDatum: null,
        adminNsButlerImps: 3,
      },
    ];
    const out = scoreBoard(results);
    expect(out.datumOk).toBe(false);
    expect(out.results[0]!.nsButlerImps).toBe(3);
    expect(out.results[0]!.ewButlerImps).toBe(-3);
    expect(out.results[0]!.usedAdminImps).toBe(true);
  });

  it("includes admin-adjusted datum-eligible score in datum set", () => {
    // N=4: discard extremes 200 and 0 → mean (100+50)/2 = 75 → datum 80
    const results: ButlerResultInput[] = [
      {
        id: "1",
        nsPairId: "a",
        ewPairId: "b",
        includedInDatum: true,
        nsScoreForDatum: 100,
        adminNsButlerImps: null,
      },
      {
        id: "2",
        nsPairId: "c",
        ewPairId: "d",
        includedInDatum: true,
        nsScoreForDatum: 0,
        adminNsButlerImps: null,
      },
      {
        id: "3",
        nsPairId: "e",
        ewPairId: "f",
        includedInDatum: true,
        nsScoreForDatum: 200,
        adminNsButlerImps: null,
      },
      {
        id: "4",
        nsPairId: "g",
        ewPairId: "h",
        includedInDatum: true,
        nsScoreForDatum: 50,
        adminNsButlerImps: null,
      },
    ];
    const out = scoreBoard(results);
    expect(out.datumOk).toBe(true);
    expect(out.nsDatum).toBe(80);
  });

  it("fails datum when N=3 leaves fewer than 2 scores after trim", () => {
    const out = scoreBoard([
      {
        id: "1",
        nsPairId: "a",
        ewPairId: "b",
        includedInDatum: true,
        nsScoreForDatum: 100,
        adminNsButlerImps: null,
      },
      {
        id: "2",
        nsPairId: "c",
        ewPairId: "d",
        includedInDatum: true,
        nsScoreForDatum: 0,
        adminNsButlerImps: null,
      },
      {
        id: "3",
        nsPairId: "e",
        ewPairId: "f",
        includedInDatum: true,
        nsScoreForDatum: 200,
        adminNsButlerImps: null,
      },
    ]);
    expect(out.datumOk).toBe(false);
  });
});

describe("assignSharedRanks", () => {
  it("shares rank on ties and skips (competition ranking)", () => {
    // PRD: two on +12 both rank 3; next is rank 5
    expect(assignSharedRanks([20, 15, 12, 12, 5])).toEqual([1, 2, 3, 3, 5]);
    expect(assignSharedRanks([20, 12, 12, 5])).toEqual([1, 2, 2, 4]);
  });

  it("can assign unique ranks when sharedRanksOnTies is false", () => {
    expect(assignSharedRanks([12, 12, 5], false)).toEqual([1, 2, 3]);
  });
});

describe("aggregation", () => {
  it("sums pair IMPs across boards with shared ranks", () => {
    const inputs: ButlerResultInput[] = [
      {
        id: "r1",
        nsPairId: "pA",
        ewPairId: "pB",
        includedInDatum: true,
        nsScoreForDatum: 110,
        adminNsButlerImps: null,
      },
      {
        id: "r2",
        nsPairId: "pC",
        ewPairId: "pD",
        includedInDatum: true,
        nsScoreForDatum: 80,
        adminNsButlerImps: null,
      },
      {
        id: "r3",
        nsPairId: "pE",
        ewPairId: "pF",
        includedInDatum: true,
        nsScoreForDatum: 90,
        adminNsButlerImps: null,
      },
      {
        id: "r4",
        nsPairId: "pG",
        ewPairId: "pH",
        includedInDatum: true,
        nsScoreForDatum: 70,
        adminNsButlerImps: null,
      },
    ];
    const board1 = scoreBoard(inputs);
    const credits = pairBoardCredits(inputs, board1.results);
    expect(credits.length).toBe(8);

    const standings = aggregatePairStandings([
      { pairId: "x", imps: 12 },
      { pairId: "y", imps: 12 },
      { pairId: "z", imps: 5 },
      { pairId: "w", imps: 20 },
      { pairId: "v", imps: 15 },
    ]);
    const byId = Object.fromEntries(standings.map((s) => [s.pairId, s]));
    expect(byId.w!.rank).toBe(1);
    expect(byId.v!.rank).toBe(2);
    expect(byId.x!.rank).toBe(3);
    expect(byId.y!.rank).toBe(3);
    expect(byId.z!.rank).toBe(5);
  });

  it("aggregates combination standings by average IMP", () => {
    const standings = aggregateCombinationStandings([
      { combinationId: "a", imps: 10, roundId: "r1" },
      { combinationId: "a", imps: 10, roundId: "r1" },
      { combinationId: "b", imps: 12, roundId: "r1" },
    ]);
    expect(standings[0]!.combinationId).toBe("b");
    expect(standings[0]!.averageImps).toBe(12);
    expect(standings[1]!.combinationId).toBe("a");
    expect(standings[1]!.averageImps).toBe(10);
  });

  it("aggregates player standings from pair credits", () => {
    const credits = [
      { pairId: "pair1", imps: 4 },
      { pairId: "pair1", imps: 2 },
      { pairId: "pair2", imps: -3 },
    ];
    const pairPlayers = new Map([
      ["pair1", { player1Id: "pl1", player2Id: "pl2" }],
      ["pair2", { player1Id: "pl3", player2Id: "pl4" }],
    ]);
    const players = aggregatePlayerStandings(credits, pairPlayers);
    const byId = Object.fromEntries(players.map((p) => [p.playerId, p]));
    expect(byId.pl1!.totalImps).toBe(6);
    expect(byId.pl2!.totalImps).toBe(6);
    expect(byId.pl1!.boardsPlayed).toBe(2);
    expect(byId.pl3!.totalImps).toBe(-3);
  });

  it("scoreAndAggregate wires boards + optional players", () => {
    const fx = loadFixture("example-a");
    const inputs = inputsFromFixture(fx);
    const pairPlayers = new Map(
      inputs.flatMap((r) => [
        [
          r.nsPairId!,
          { player1Id: `${r.nsPairId}-1`, player2Id: `${r.nsPairId}-2` },
        ],
        [
          r.ewPairId!,
          { player1Id: `${r.ewPairId}-1`, player2Id: `${r.ewPairId}-2` },
        ],
      ]),
    );
    const { boards, pairStandings, playerStandings } = scoreAndAggregate(
      [{ results: inputs }],
      { pairPlayers },
    );
    expect(boards[0]!.nsDatum).toBe(50);
    expect(pairStandings.length).toBeGreaterThan(0);
    expect(playerStandings).not.toBeNull();
    expect(playerStandings!.length).toBe(pairStandings.length * 2);
  });
});
