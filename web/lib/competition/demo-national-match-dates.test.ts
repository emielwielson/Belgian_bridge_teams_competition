import { describe, expect, it } from "vitest";
import {
  DEMO_DEFAULT_ROUNDS,
  DEMO_FIRST_ROUNDS,
  DEMO_HONOR_ROUNDS,
} from "./demo-national-match-dates";

describe("demo national match dates", () => {
  it("has expected round counts per schedule", () => {
    expect(DEMO_HONOR_ROUNDS).toHaveLength(21);
    expect(DEMO_FIRST_ROUNDS).toHaveLength(14);
    expect(DEMO_DEFAULT_ROUNDS).toHaveLength(14);
  });

  it("honor uses triple-header slots on each match day", () => {
    const day1 = DEMO_HONOR_ROUNDS.filter((r) => r.date === "2024-09-27");
    expect(day1).toHaveLength(3);
    expect(day1.map((r) => r.time)).toEqual(["11:00", "13:50", "16:40"]);
  });

  it("1st division has two slots on the first match day", () => {
    const day1 = DEMO_FIRST_ROUNDS.filter((r) => r.date === "2024-09-27");
    expect(day1).toHaveLength(2);
  });

  it("default schedule has one slot at 14:00 per day", () => {
    expect(DEMO_DEFAULT_ROUNDS.every((r) => r.time === "14:00")).toBe(true);
  });
});
