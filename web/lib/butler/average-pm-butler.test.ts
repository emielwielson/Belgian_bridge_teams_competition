import { describe, expect, it } from "vitest";
import {
  butlerImpsForAverageAward,
  combinationRoundAverages,
} from "./average-pm-butler";

describe("butlerImpsForAverageAward", () => {
  it("awards max(2, avg) for plus", () => {
    expect(butlerImpsForAverageAward("plus", null)).toBe(2);
    expect(butlerImpsForAverageAward("plus", 1)).toBe(2);
    expect(butlerImpsForAverageAward("plus", 2)).toBe(2);
    expect(butlerImpsForAverageAward("plus", 5)).toBe(5);
  });

  it("awards min(-2, avg) for minus", () => {
    expect(butlerImpsForAverageAward("minus", null)).toBe(-2);
    expect(butlerImpsForAverageAward("minus", -1)).toBe(-2);
    expect(butlerImpsForAverageAward("minus", -2)).toBe(-2);
    expect(butlerImpsForAverageAward("minus", -5)).toBe(-5);
  });
});

describe("combinationRoundAverages", () => {
  it("averages credits per combination", () => {
    const avgs = combinationRoundAverages([
      { combinationId: "a", imps: 4 },
      { combinationId: "a", imps: 8 },
      { combinationId: "b", imps: 1 },
    ]);
    expect(avgs.get("a")).toBe(6);
    expect(avgs.get("b")).toBe(1);
  });
});
