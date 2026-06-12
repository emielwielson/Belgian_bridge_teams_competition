import { describe, expect, it } from "vitest";
import {
  allowsBoardChoice,
  nominalBoardCount,
  scheduledBoardCount,
  validateScoreBoardOptions,
  vpBoardCount,
  vpBoardCountsForGroup,
  BoardCountValidationError,
} from "./board-count-rules";

describe("nominalBoardCount", () => {
  it("national honor → 16", () => {
    expect(
      nominalBoardCount({ leagueScope: "national", divisionLevelCode: "honor" }),
    ).toBe(16);
  });

  it("national 1st → 20", () => {
    expect(
      nominalBoardCount({ leagueScope: "national", divisionLevelCode: "first" }),
    ).toBe(20);
  });

  it("national 2nd/3rd → 32", () => {
    expect(
      nominalBoardCount({ leagueScope: "national", divisionLevelCode: "second" }),
    ).toBe(32);
    expect(
      nominalBoardCount({ leagueScope: "national", divisionLevelCode: "third" }),
    ).toBe(32);
  });

  it("regional 1st → 32", () => {
    expect(
      nominalBoardCount({ leagueScope: "regional", divisionLevelCode: "first" }),
    ).toBe(32);
  });

  it("regional 2nd/3rd → null (choice)", () => {
    expect(
      nominalBoardCount({ leagueScope: "regional", divisionLevelCode: "second" }),
    ).toBeNull();
    expect(
      nominalBoardCount({ leagueScope: "regional", divisionLevelCode: "third" }),
    ).toBeNull();
  });
});

describe("allowsBoardChoice", () => {
  it("only regional 2nd and 3rd", () => {
    expect(
      allowsBoardChoice({ leagueScope: "regional", divisionLevelCode: "second" }),
    ).toBe(true);
    expect(
      allowsBoardChoice({ leagueScope: "regional", divisionLevelCode: "third" }),
    ).toBe(true);
    expect(
      allowsBoardChoice({ leagueScope: "regional", divisionLevelCode: "first" }),
    ).toBe(false);
    expect(
      allowsBoardChoice({ leagueScope: "national", divisionLevelCode: "second" }),
    ).toBe(false);
  });
});

describe("vpBoardCount", () => {
  it("returns nominal when no mis-seating", () => {
    expect(vpBoardCount(32, false)).toBe(32);
  });

  it("returns 3/4 when mis-seating", () => {
    expect(vpBoardCount(32, true)).toBe(24);
    expect(vpBoardCount(28, true)).toBe(21);
    expect(vpBoardCount(20, true)).toBe(15);
    expect(vpBoardCount(16, true)).toBe(12);
  });
});

describe("vpBoardCountsForGroup", () => {
  it("national honor includes 16 and 12", () => {
    expect(
      vpBoardCountsForGroup({ leagueScope: "national", divisionLevelCode: "honor" }),
    ).toEqual([12, 16]);
  });

  it("regional 2nd includes 28, 32, 21, 24", () => {
    expect(
      vpBoardCountsForGroup({ leagueScope: "regional", divisionLevelCode: "second" }),
    ).toEqual([21, 24, 28, 32]);
  });
});

describe("scheduledBoardCount", () => {
  it("defaults regional 2nd/3rd to 32", () => {
    expect(
      scheduledBoardCount({ leagueScope: "regional", divisionLevelCode: "second" }),
    ).toBe(32);
  });
});

describe("validateScoreBoardOptions", () => {
  const regionalSecond = {
    leagueScope: "regional" as const,
    divisionLevelCode: "second" as const,
  };

  it("requires board choice for regional 2nd", () => {
    expect(() => validateScoreBoardOptions(regionalSecond, {})).toThrow(
      BoardCountValidationError,
    );
  });

  it("accepts 28 with mis-seating", () => {
    expect(
      validateScoreBoardOptions(regionalSecond, {
        selectedBoardCount: 28,
        misSeating: true,
      }),
    ).toEqual({ nominal: 28, vpBoardCount: 21, misSeating: true });
  });

  it("rejects board choice on national", () => {
    expect(() =>
      validateScoreBoardOptions(
        { leagueScope: "national", divisionLevelCode: "honor" },
        { selectedBoardCount: 28 },
      ),
    ).toThrow(BoardCountValidationError);
  });

  it("national honor with mis-seating", () => {
    expect(
      validateScoreBoardOptions(
        { leagueScope: "national", divisionLevelCode: "honor" },
        { misSeating: true },
      ),
    ).toEqual({ nominal: 16, vpBoardCount: 12, misSeating: true });
  });
});
