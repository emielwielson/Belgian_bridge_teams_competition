import { describe, expect, it } from "vitest";
import { bridgemateBoardRangeForRound, buildBwsSession } from "./bws-session";

function honorDivisionInput() {
  const pairs = [
    { id: "p11", bridgematePairNumber: 11 },
    { id: "p12", bridgematePairNumber: 12 },
    { id: "p21", bridgematePairNumber: 21 },
    { id: "p22", bridgematePairNumber: 22 },
    { id: "p31", bridgematePairNumber: 31 },
    { id: "p32", bridgematePairNumber: 32 },
    { id: "p41", bridgematePairNumber: 41 },
    { id: "p42", bridgematePairNumber: 42 },
    { id: "p51", bridgematePairNumber: 51 },
    { id: "p52", bridgematePairNumber: 52 },
    { id: "p61", bridgematePairNumber: 61 },
    { id: "p62", bridgematePairNumber: 62 },
    { id: "p71", bridgematePairNumber: 71 },
    { id: "p72", bridgematePairNumber: 72 },
    { id: "p81", bridgematePairNumber: 81 },
    { id: "p82", bridgematePairNumber: 82 },
  ];

  const matches = [
    {
      id: "m1",
      boardCount: 16,
      tables: [
        {
          id: "t1",
          bridgemateSection: "A",
          bridgemateTable: 1,
          nsPairId: "p11",
          ewPairId: "p81",
        },
        {
          id: "t2",
          bridgemateSection: "A",
          bridgemateTable: 2,
          nsPairId: "p82",
          ewPairId: "p12",
        },
      ],
    },
    {
      id: "m2",
      boardCount: 16,
      tables: [
        {
          id: "t3",
          bridgemateSection: "A",
          bridgemateTable: 3,
          nsPairId: "p21",
          ewPairId: "p71",
        },
        {
          id: "t4",
          bridgemateSection: "A",
          bridgemateTable: 4,
          nsPairId: "p72",
          ewPairId: "p22",
        },
      ],
    },
    {
      id: "m3",
      boardCount: 16,
      tables: [
        {
          id: "t5",
          bridgemateSection: "A",
          bridgemateTable: 5,
          nsPairId: "p31",
          ewPairId: "p61",
        },
        {
          id: "t6",
          bridgemateSection: "A",
          bridgemateTable: 6,
          nsPairId: "p62",
          ewPairId: "p32",
        },
      ],
    },
    {
      id: "m4",
      boardCount: 16,
      tables: [
        {
          id: "t7",
          bridgemateSection: "A",
          bridgemateTable: 7,
          nsPairId: "p41",
          ewPairId: "p51",
        },
        {
          id: "t8",
          bridgemateSection: "A",
          bridgemateTable: 8,
          nsPairId: "p52",
          ewPairId: "p42",
        },
      ],
    },
  ];

  return { tournamentRoundNumber: 3, matches, pairs };
}

describe("buildBwsSession", () => {
  it("builds Honor Division 8-table plan with groups and pair numbers", () => {
    const result = buildBwsSession(honorDivisionInput(), {
      guid: "11111111-2222-3333-4444-555555555555",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.filename).toBe("honneur-ronde-3.bws");
    expect(result.plan.session).toMatchObject({
      id: 1,
      name: "Honneur ronde 3",
      guid: "{11111111-2222-3333-4444-555555555555}",
      status: 0,
      ewReturnHome: false,
    });
    expect(result.plan.sections).toEqual([
      {
        id: 1,
        letter: "A",
        tables: 8,
        missingPair: 0,
        ewMoveBeforePlay: 0,
        session: 1,
        scoringType: 4,
        winners: 2,
      },
    ]);
    expect(result.plan.tables.map((t) => [t.table, t.group])).toEqual([
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 2],
      [5, 3],
      [6, 3],
      [7, 4],
      [8, 4],
    ]);
    expect(result.plan.roundData[0]).toMatchObject({
      section: 1,
      table: 1,
      round: 1,
      nsPair: 11,
      ewPair: 81,
      lowBoard: 33,
      highBoard: 48,
      customBoards: null,
    });
    expect(result.plan.roundData[1]).toMatchObject({
      table: 2,
      nsPair: 82,
      ewPair: 12,
    });
  });

  it("fails with Dutch error when Bridgemate pair number is missing", () => {
    const input = honorDivisionInput();
    (input.pairs as Array<{ id: string; bridgematePairNumber: number | null }>)[0] =
      { id: "p11", bridgematePairNumber: null };
    const result = buildBwsSession(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => /Bridgemate-paarnummer/.test(e))).toBe(
      true,
    );
  });

  it("fails when section/table is duplicated", () => {
    const input = honorDivisionInput();
    input.matches[1].tables[0].bridgemateTable = 1;
    const result = buildBwsSession(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => /Dubbele Bridgemate-tafel/.test(e))).toBe(
      true,
    );
  });
});

describe("bridgemateBoardRangeForRound", () => {
  it("maps match-day slots to absolute boards 1-48", () => {
    expect(bridgemateBoardRangeForRound(1, 16)).toEqual({
      lowBoard: 1,
      highBoard: 16,
    });
    expect(bridgemateBoardRangeForRound(2, 16)).toEqual({
      lowBoard: 17,
      highBoard: 32,
    });
    expect(bridgemateBoardRangeForRound(3, 16)).toEqual({
      lowBoard: 33,
      highBoard: 48,
    });
    expect(bridgemateBoardRangeForRound(4, 16)).toEqual({
      lowBoard: 1,
      highBoard: 16,
    });
  });
});
