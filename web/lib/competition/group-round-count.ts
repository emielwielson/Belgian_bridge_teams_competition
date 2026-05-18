import {
  computeRoundCount,
  roundsPerCycle,
} from "@/lib/scheduling/round-robin-schedule";

export { computeRoundCount, roundsPerCycle };

export function maxRoundRobinCountForDates(
  teamCount: number,
  availableDates: number,
): number {
  const perCycle = roundsPerCycle(teamCount);
  if (perCycle === 0) return 0;
  return Math.floor(availableDates / perCycle);
}
