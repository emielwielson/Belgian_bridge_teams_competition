import { describe, expect, it } from "vitest";
import {
  buildRoundRobinSchedule,
  buildSingleRoundRobinCycle,
  computeRoundCount,
  roundsPerCycle,
} from "./round-robin-schedule";

describe("round-robin-schedule", () => {
  const teams4 = ["a", "b", "c", "d"];
  const teams7 = ["t1", "t2", "t3", "t4", "t5", "t6", "t7"];

  it("computes rounds per cycle", () => {
    expect(roundsPerCycle(4)).toBe(3);
    expect(roundsPerCycle(7)).toBe(7);
    expect(roundsPerCycle(8)).toBe(7);
    expect(computeRoundCount(4, 4)).toBe(12);
    expect(computeRoundCount(7, 2)).toBe(14);
  });

  it("assigns exactly one bye per round for odd teams", () => {
    const cycle = buildSingleRoundRobinCycle(teams7);
    expect(cycle).toHaveLength(7);
    for (const round of cycle) {
      expect(round.pairings).toHaveLength(3);
      expect(round.byeTeamId).not.toBeNull();
      const playing = new Set<string>();
      for (const p of round.pairings) {
        playing.add(p.homeTeamId);
        playing.add(p.awayTeamId);
      }
      expect(playing.size).toBe(6);
      expect(playing.has(round.byeTeamId!)).toBe(false);
    }
  });

  it("has no bye for even teams", () => {
    const cycle = buildSingleRoundRobinCycle(teams4);
    expect(cycle).toHaveLength(3);
    for (const round of cycle) {
      expect(round.byeTeamId).toBeNull();
      expect(round.pairings).toHaveLength(2);
    }
  });

  it("double round robin mirrors home/away in second cycle", () => {
    const schedule = buildRoundRobinSchedule(teams4, 2);
    expect(schedule).toHaveLength(6);
    const leg1 = schedule[0]!.pairings[0]!;
    const leg2 = schedule[3]!.pairings.find(
      (p) =>
        (p.homeTeamId === leg1.awayTeamId &&
          p.awayTeamId === leg1.homeTeamId) ||
        (p.homeTeamId === leg1.homeTeamId && p.awayTeamId === leg1.awayTeamId),
    );
    expect(leg2).toBeDefined();
  });

  it("each pair meets once in a single cycle (4 teams)", () => {
    const cycle = buildSingleRoundRobinCycle(teams4);
    const meetings = new Map<string, number>();
    for (const round of cycle) {
      for (const p of round.pairings) {
        const key = [p.homeTeamId, p.awayTeamId].sort().join(":");
        meetings.set(key, (meetings.get(key) ?? 0) + 1);
      }
    }
    expect(meetings.size).toBe(6);
    for (const count of meetings.values()) {
      expect(count).toBe(1);
    }
  });
});
