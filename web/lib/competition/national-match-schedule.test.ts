import { describe, expect, it } from "vitest";
import {
  collapseRoundsToMatchDays,
  expandMatchDaysToRounds,
  honorMatchDayIndexForRound,
  NATIONAL_MATCH_DAY_COUNTS,
} from "./national-match-schedule";

describe("national match schedule", () => {
  it("expands honor to 21 rounds from 7 days", () => {
    const days = [
      "2024-09-27",
      "2024-10-04",
      "2024-10-11",
      "2024-10-18",
      "2024-11-08",
      "2024-11-22",
      "2024-11-29",
    ];
    const rounds = expandMatchDaysToRounds("honor", days);
    expect(rounds).toHaveLength(21);
    const day1 = rounds.filter((r) => r.datetime.startsWith("2024-09-27"));
    expect(day1.map((r) => r.round)).toEqual([1, 2, 3]);
    expect(day1.map((r) => r.datetime)).toEqual([
      "2024-09-27T11:00",
      "2024-09-27T13:50",
      "2024-09-27T16:40",
    ]);
    const day2 = rounds.filter((r) => r.datetime.startsWith("2024-10-04"));
    expect(day2.map((r) => r.round)).toEqual([4, 5, 6]);
  });

  it("round-trips match days for honor division", () => {
    const days = [
      "2024-09-27",
      "2024-10-04",
      "2024-10-11",
      "2024-10-18",
      "2024-11-08",
      "2024-11-22",
      "2024-11-29",
    ];
    const rounds = expandMatchDaysToRounds("honor", days);
    expect(rounds).toHaveLength(21);
    const collapsed = collapseRoundsToMatchDays("honor", rounds);
    expect(collapsed).toEqual(days);
  });

  it("round-trips match days for 1st division", () => {
    const days = ["2024-09-27", "2024-10-04", "2024-10-11", "2024-10-18", "2024-11-08", "2024-11-22", "2024-11-29"];
    const rounds = expandMatchDaysToRounds("first", days);
    expect(rounds).toHaveLength(14);
    const collapsed = collapseRoundsToMatchDays("first", rounds);
    expect(collapsed).toEqual(days);
  });

  it("stacks first-leg and mirror rounds on the same day for 1st division", () => {
    const days = [
      "2024-09-27",
      "2024-10-04",
      "2024-10-11",
      "2024-10-18",
      "2024-11-08",
      "2024-11-22",
      "2024-11-29",
    ];
    const rounds = expandMatchDaysToRounds("first", days);
    const day1 = rounds.filter((r) => r.datetime.startsWith("2024-09-27"));
    expect(day1.map((r) => r.round)).toEqual([1, 8]);
    expect(day1.map((r) => r.datetime)).toEqual([
      "2024-09-27T13:00",
      "2024-09-27T16:00",
    ]);
    const day2 = rounds.filter((r) => r.datetime.startsWith("2024-10-04"));
    expect(day2.map((r) => r.round)).toEqual([2, 9]);
  });

  it("expects 14 days for default schedule", () => {
    expect(NATIONAL_MATCH_DAY_COUNTS.default).toBe(14);
  });

  it("maps honor rounds 1–21 to match days 1–7", () => {
    expect(honorMatchDayIndexForRound(1)).toBe(1);
    expect(honorMatchDayIndexForRound(2)).toBe(1);
    expect(honorMatchDayIndexForRound(3)).toBe(1);
    expect(honorMatchDayIndexForRound(4)).toBe(2);
    expect(honorMatchDayIndexForRound(7)).toBe(3);
    expect(honorMatchDayIndexForRound(9)).toBe(3);
    expect(honorMatchDayIndexForRound(19)).toBe(7);
    expect(honorMatchDayIndexForRound(21)).toBe(7);
  });

  it("rejects out-of-range honor rounds", () => {
    expect(() => honorMatchDayIndexForRound(0)).toThrow();
    expect(() => honorMatchDayIndexForRound(22)).toThrow();
  });
});
