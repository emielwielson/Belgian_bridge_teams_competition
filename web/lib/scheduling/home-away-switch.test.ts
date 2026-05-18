import { describe, expect, it } from "vitest";
import {
  firstLegRoundForMirror,
  isMirroredHomeAway,
  isRbbfMirrorRound,
  needsMirrorHomeAway,
  sameFixtureTeamPair,
} from "./home-away-switch";

describe("home-away-switch", () => {
  it("identifies mirror rounds 8–14 for RBBF 14- and 21-round groups", () => {
    expect(isRbbfMirrorRound(7, 14)).toBe(false);
    expect(isRbbfMirrorRound(8, 14)).toBe(true);
    expect(isRbbfMirrorRound(14, 14)).toBe(true);
    expect(isRbbfMirrorRound(15, 21)).toBe(false);
    expect(isRbbfMirrorRound(14, 21)).toBe(true);
  });

  it("maps mirror round to first leg round", () => {
    expect(firstLegRoundForMirror(8)).toBe(1);
    expect(firstLegRoundForMirror(14)).toBe(7);
  });

  it("detects same fixture regardless of home/away order", () => {
    expect(sameFixtureTeamPair("a", "b", "a", "b")).toBe(true);
    expect(sameFixtureTeamPair("a", "b", "b", "a")).toBe(true);
    expect(sameFixtureTeamPair("a", "b", "c", "d")).toBe(false);
  });

  it("needs mirror when sides match first leg", () => {
    const first = { homeTeamId: "h", awayTeamId: "a" };
    expect(needsMirrorHomeAway(first, { homeTeamId: "h", awayTeamId: "a" })).toBe(
      true,
    );
    expect(needsMirrorHomeAway(first, { homeTeamId: "a", awayTeamId: "h" })).toBe(
      false,
    );
    expect(isMirroredHomeAway(first, { homeTeamId: "a", awayTeamId: "h" })).toBe(
      true,
    );
  });
});
