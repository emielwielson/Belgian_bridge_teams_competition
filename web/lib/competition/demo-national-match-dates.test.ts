import { describe, expect, it } from "vitest";
import {
  DEMO_DEFAULT_ROUNDS,
  DEMO_FIRST_ROUNDS,
  DEMO_HONOR_ROUNDS,
} from "./demo-national-match-dates";

describe("demo national match dates", () => {
  it("honor has 21 rounds on 7 days with three fixed slots", () => {
    expect(DEMO_HONOR_ROUNDS).toHaveLength(21);
    const day1 = DEMO_HONOR_ROUNDS.filter((r) => r.date === "2024-09-27");
    expect(day1).toHaveLength(3);
    expect(day1.map((r) => r.time)).toEqual(["11:00", "13:50", "16:40"]);
    expect(DEMO_HONOR_ROUNDS[20].date).toBe("2024-11-29");
    expect(DEMO_HONOR_ROUNDS[20].time).toBe("16:40");
  });

  it("1st division has 14 rounds on 7 days with two fixed slots", () => {
    expect(DEMO_FIRST_ROUNDS).toHaveLength(14);
    const day1 = DEMO_FIRST_ROUNDS.filter((r) => r.date === "2024-09-27");
    expect(day1).toHaveLength(2);
    expect(day1.map((r) => r.time)).toEqual(["13:00", "16:00"]);
  });

  it("default schedule has 14 rounds at 14:00", () => {
    expect(DEMO_DEFAULT_ROUNDS).toHaveLength(14);
    expect(DEMO_DEFAULT_ROUNDS.every((r) => r.time === "14:00")).toBe(true);
  });
});
