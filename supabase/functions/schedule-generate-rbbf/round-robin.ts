/** Circle-method round robin (Deno copy of web/lib/scheduling/round-robin-schedule.ts). */

export type TeamPairing = { homeTeamId: string; awayTeamId: string };

export type RoundPlan = {
  round: number;
  pairings: TeamPairing[];
  byeTeamId: string | null;
};

export function buildSingleRoundRobinCycle(teamIds: string[]): RoundPlan[] {
  if (teamIds.length < 2) {
    throw new Error("Round robin requires at least 2 teams");
  }

  const n = teamIds.length;
  const isOdd = n % 2 === 1;
  const slots: (string | null)[] = isOdd ? [...teamIds, null] : [...teamIds];
  const slotCount = slots.length;
  const roundsInCycle = slotCount - 1;
  const plans: RoundPlan[] = [];

  for (let r = 0; r < roundsInCycle; r++) {
    const pairings: TeamPairing[] = [];
    let byeTeamId: string | null = null;

    for (let i = 0; i < slotCount / 2; i++) {
      const a = slots[i];
      const b = slots[slotCount - 1 - i];
      if (a === null) {
        byeTeamId = b;
        continue;
      }
      if (b === null) {
        byeTeamId = a;
        continue;
      }
      pairings.push({ homeTeamId: a, awayTeamId: b });
    }

    plans.push({ round: r + 1, pairings, byeTeamId });

    const fixed = slots[0];
    const rotating = slots.slice(1);
    const last = rotating.pop();
    if (last !== undefined) rotating.unshift(last);
    slots.splice(0, slots.length, fixed, ...rotating);
  }

  return plans;
}

function mirrorPairings(pairings: TeamPairing[]): TeamPairing[] {
  return pairings.map((p) => ({
    homeTeamId: p.awayTeamId,
    awayTeamId: p.homeTeamId,
  }));
}

export function buildRoundRobinSchedule(
  teamIds: string[],
  roundRobinCount: number,
): RoundPlan[] {
  const cycles = Math.max(roundRobinCount, 1);
  const cyclePlans = buildSingleRoundRobinCycle(teamIds);
  const roundsPerLeg = cyclePlans.length;
  const allPlans: RoundPlan[] = [];

  for (let cycle = 0; cycle < cycles; cycle++) {
    const leg =
      cycle % 2 === 0
        ? cyclePlans
        : cyclePlans.map((plan) => ({
            round: plan.round,
            pairings: mirrorPairings(plan.pairings),
            byeTeamId: plan.byeTeamId,
          }));

    for (const plan of leg) {
      allPlans.push({
        round: cycle * roundsPerLeg + plan.round,
        pairings: plan.pairings,
        byeTeamId: plan.byeTeamId,
      });
    }
  }

  return allPlans;
}
