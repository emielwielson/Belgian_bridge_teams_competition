import { describe, expect, it } from "vitest";
import {
  FLANDERS_12_ROUNDS,
  FLANDERS_14_ROUNDS,
} from "./demo-flanders-match-dates";

describe("demo flanders match dates", () => {
  it("has 14 shared match days at 14:00", () => {
    expect(FLANDERS_14_ROUNDS).toHaveLength(14);
    expect(FLANDERS_14_ROUNDS.every((r) => r.time === "14:00")).toBe(true);
  });

  it("12-round groups use the first twelve match days", () => {
    expect(FLANDERS_12_ROUNDS).toHaveLength(12);
    expect(FLANDERS_12_ROUNDS.map((r) => r.date)).toEqual(
      FLANDERS_14_ROUNDS.slice(0, 12).map((r) => r.date),
    );
  });

  it("starts on 27 September 2024", () => {
    expect(FLANDERS_14_ROUNDS[0]?.date).toBe("2024-09-27");
  });
});
