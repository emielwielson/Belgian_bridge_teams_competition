/**
 * Law 12C1c weighted assigned scores for Honor team match IMPs:
 * convert each possible outcome to IMP, then weigh; round .5 favoring NOP.
 */

import type {
  NonOffendingSide,
  WeightedMatchImpsOverride,
  WeightedScoreLeg,
} from "@/lib/results/types";
import { pointsToImps } from "@/lib/scoring/wbf-imp-table";

export type FavorTeam = "home" | "away";

export type WeightedRoomSide = {
  legs: readonly WeightedScoreLeg[];
  nonOffendingSide: NonOffendingSide | null;
};

/**
 * Map table NS/EW NOP to home/away (open NS = home, closed NS = away).
 */
export function favorTeamFromRoomNop(
  room: "open" | "closed",
  nonOffendingSide: NonOffendingSide,
): FavorTeam {
  if (room === "open") {
    return nonOffendingSide === "ns" ? "home" : "away";
  }
  return nonOffendingSide === "ns" ? "away" : "home";
}

/**
 * Resolve which team to favor when rounding .5.
 * Both rooms weighted with disagreeing NOPs → null (half away from zero).
 */
export function resolveFavorTeam(input: {
  openNop: NonOffendingSide | null;
  closedNop: NonOffendingSide | null;
  openWeighted: boolean;
  closedWeighted: boolean;
}): FavorTeam | null {
  const favors: FavorTeam[] = [];
  if (input.openWeighted && input.openNop != null) {
    favors.push(favorTeamFromRoomNop("open", input.openNop));
  }
  if (input.closedWeighted && input.closedNop != null) {
    favors.push(favorTeamFromRoomNop("closed", input.closedNop));
  }
  if (favors.length === 0) return null;
  if (favors.every((f) => f === "home")) return "home";
  if (favors.every((f) => f === "away")) return "away";
  return null;
}

/**
 * Round a (possibly fractional) net board IMP.
 * Exact .5: favor home/away when set; otherwise half away from zero.
 * Other fractions: half away from zero.
 */
export function roundImpsFavoring(
  net: number,
  favor: FavorTeam | null,
): number {
  if (!Number.isFinite(net)) {
    throw new Error("Ongeldige gewogen IMP-score.");
  }
  const abs = Math.abs(net);
  const frac = abs - Math.floor(abs);
  const isHalf = Math.abs(frac - 0.5) < 1e-9;

  if (isHalf && favor === "home") {
    // Toward home gain: +4.5→5, −4.5→−4
    return Math.ceil(net);
  }
  if (isHalf && favor === "away") {
    // Toward away gain: +4.5→4, −4.5→−5
    return Math.floor(net);
  }
  // Half away from zero (and non-half mathematical round)
  if (net >= 0) return Math.round(net);
  // Math.round(-4.5) === -4 in JS; force away from zero at .5
  if (isHalf) return -Math.round(abs);
  return -Math.round(abs);
}

function nsWeights(legs: readonly WeightedScoreLeg[]): {
  scores: number[];
  weights: number[];
} {
  const scores: number[] = [];
  const weights: number[] = [];
  for (const leg of legs) {
    if (!(leg.weightNs > 0)) {
      throw new Error("Gewichten moeten groter dan 0 zijn.");
    }
    if (!Number.isFinite(leg.score)) {
      throw new Error("Ongeldige score in gewogen resultaat.");
    }
    scores.push(leg.score);
    weights.push(leg.weightNs);
  }
  return { scores, weights };
}

/**
 * Weighted mean of per-outcome board IMPs (home perspective), then rounded.
 * Returns home/away credits for an assigned board entry (one side non-zero).
 */
export function weightedMatchImpsFromLegs(input: {
  open: WeightedRoomSide | { nsScore: number };
  closed: WeightedRoomSide | { nsScore: number };
}): { homeImps: number; awayImps: number; net: number; roundedNet: number } {
  let openScores: number[];
  let openWeights: number[];
  let closedScores: number[];
  let closedWeights: number[];
  let openNop: NonOffendingSide | null = null;
  let closedNop: NonOffendingSide | null = null;
  let openWeighted = false;
  let closedWeighted = false;

  if ("legs" in input.open) {
    openWeighted = true;
    const nw = nsWeights(input.open.legs);
    openScores = nw.scores;
    openWeights = nw.weights;
    openNop = input.open.nonOffendingSide;
  } else {
    openScores = [input.open.nsScore];
    openWeights = [1];
  }

  if ("legs" in input.closed) {
    closedWeighted = true;
    const nw = nsWeights(input.closed.legs);
    closedScores = nw.scores;
    closedWeights = nw.weights;
    closedNop = input.closed.nonOffendingSide;
  } else {
    closedScores = [input.closed.nsScore];
    closedWeights = [1];
  }

  if (openWeighted && openScores.length < 2) {
    throw new Error("Gewogen score vereist minstens twee scores.");
  }
  if (closedWeighted && closedScores.length < 2) {
    throw new Error("Gewogen score vereist minstens twee scores.");
  }

  let weightedSum = 0;
  let weightSum = 0;
  for (let i = 0; i < openScores.length; i++) {
    for (let j = 0; j < closedScores.length; j++) {
      const w = openWeights[i]! * closedWeights[j]!;
      const boardImps = pointsToImps(openScores[i]! - closedScores[j]!);
      weightedSum += w * boardImps;
      weightSum += w;
    }
  }
  if (!(weightSum > 0)) {
    throw new Error("Ongeldige gewichten voor gewogen IMP-score.");
  }

  const net = weightedSum / weightSum;
  const favor = resolveFavorTeam({
    openNop,
    closedNop,
    openWeighted,
    closedWeighted,
  });
  const roundedNet = roundImpsFavoring(net, favor);

  if (roundedNet > 0) {
    return { homeImps: roundedNet, awayImps: 0, net, roundedNet };
  }
  if (roundedNet < 0) {
    return { homeImps: 0, awayImps: -roundedNet, net, roundedNet };
  }
  return { homeImps: 0, awayImps: 0, net, roundedNet: 0 };
}

export function parseWeightedLegsFromMeta(
  meta: Record<string, unknown> | null | undefined,
): WeightedScoreLeg[] | null {
  if (!meta || typeof meta !== "object") return null;
  if (!Array.isArray(meta.legs)) return null;
  const legs: WeightedScoreLeg[] = [];
  for (const raw of meta.legs) {
    if (!raw || typeof raw !== "object") return null;
    const leg = raw as Record<string, unknown>;
    const score = Number(leg.score);
    const weightNs = Number(leg.weightNs ?? leg.weight_ns);
    const weightEw = Number(leg.weightEw ?? leg.weight_ew);
    if (![score, weightNs, weightEw].every((n) => Number.isFinite(n))) {
      return null;
    }
    if (!(weightNs > 0) || !(weightEw > 0)) return null;
    legs.push({ score, weightNs, weightEw });
  }
  return legs.length >= 2 ? legs : null;
}

export function parseNonOffendingSide(
  raw: unknown,
): NonOffendingSide | null {
  if (raw === "ns" || raw === "ew") return raw;
  return null;
}

export function parseMatchImpsOverride(
  raw: unknown,
): WeightedMatchImpsOverride | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const homeImps = Number(o.homeImps ?? o.home_imps);
  const awayImps = Number(o.awayImps ?? o.away_imps);
  if (
    !Number.isFinite(homeImps) ||
    !Number.isFinite(awayImps) ||
    !Number.isInteger(homeImps) ||
    !Number.isInteger(awayImps)
  ) {
    return null;
  }
  return { homeImps, awayImps };
}

export type ParsedWeightedMatchMeta = {
  legs: WeightedScoreLeg[] | null;
  nonOffendingSide: NonOffendingSide | null;
  matchImpsOverride: WeightedMatchImpsOverride | null;
};

export function parseWeightedMatchMeta(
  meta: Record<string, unknown> | null | undefined,
): ParsedWeightedMatchMeta {
  if (!meta || typeof meta !== "object") {
    return {
      legs: null,
      nonOffendingSide: null,
      matchImpsOverride: null,
    };
  }
  return {
    legs: parseWeightedLegsFromMeta(meta),
    nonOffendingSide: parseNonOffendingSide(meta.nonOffendingSide),
    matchImpsOverride: parseMatchImpsOverride(meta.matchImpsOverride),
  };
}
