import { describe, expect, it } from "vitest";
import {
  collapseRoundsToMatchDays,
  expandMatchDaysToRounds,
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
    expect(day1.map((r) => r.round)).toEqual([1, 8, 15]);
    expect(day1.map((r) => r.datetime)).toEqual([
      "2024-09-27T11:00",
      "2024-09-27T13:50",
      "2024-09-27T16:40",
    ]);
    const day2 = rounds.filter((r) => r.datetime.startsWith("2024-10-04"));
    expect(day2.map((r) => r.round)).toEqual([2, 9, 16]);
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
});
