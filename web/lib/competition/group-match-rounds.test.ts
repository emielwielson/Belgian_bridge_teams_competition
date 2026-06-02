import { describe, expect, it } from "vitest";
import {
  defaultSkippedRounds,
  effectiveTeamCount,
  isSelectionComplete,
  needsSkippedDateSelection,
  usedRoundsFromSkipped,
  validateSkippedRounds,
} from "./group-match-rounds";
import { emptyScheduleSlots } from "./group-schedule-slots";

describe("group-match-rounds", () => {
  it("defaultSkippedRounds skips trailing dates", () => {
    expect(defaultSkippedRounds(6)).toEqual([7, 8, 9, 10, 11, 12, 13, 14]);
    expect(defaultSkippedRounds(14)).toEqual([]);
  });

  it("usedRoundsFromSkipped inverts skipped set", () => {
    expect(usedRoundsFromSkipped(6, [7, 8, 9, 10, 11, 12, 13, 14])).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(
      usedRoundsFromSkipped(6, [1, 3, 5, 7, 9, 11, 13, 14]),
    ).toEqual([2, 4, 6, 8, 10, 12]);
  });

  it("validateSkippedRounds enforces count", () => {
    expect(validateSkippedRounds(6, [7, 8, 9, 10, 11, 12, 13, 14])).toBeNull();
    expect(validateSkippedRounds(6, [7, 8, 9])).toMatch(/Expected 8 skipped/);
  });

  it("needsSkippedDateSelection for regional small groups only", () => {
    expect(needsSkippedDateSelection("regional", 6, false)).toBe(true);
    expect(needsSkippedDateSelection("regional", 14, false)).toBe(false);
    expect(needsSkippedDateSelection("regional", 6, true)).toBe(false);
    expect(needsSkippedDateSelection("national", 6, false)).toBe(false);
  });

  it("effectiveTeamCount treats RBBF as 8", () => {
    const slots = emptyScheduleSlots().map((s, i) =>
      i < 8 ? { ...s, teamId: `t${i + 1}` } : s,
    );
    expect(effectiveTeamCount("regional", 8, slots)).toBe(8);
    expect(effectiveTeamCount("regional", 6, emptyScheduleSlots())).toBe(6);
  });

  it("isSelectionComplete checks used round count", () => {
    expect(isSelectionComplete(6, [1, 2, 3, 4, 5, 6])).toBe(true);
    expect(isSelectionComplete(6, [1, 2, 3])).toBe(false);
  });
});
