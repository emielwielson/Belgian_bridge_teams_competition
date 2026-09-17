import type {
  ContractDenomination,
  Doubling,
  Declarer,
  Vulnerability,
} from "@/lib/boards/types";

export type ContractScoreInput = {
  contractLevel: number | null;
  contractDenomination: ContractDenomination | null;
  doubling: Doubling;
  declarer: Declarer | null;
  /** Absolute tricks taken by declarer (0–13). Preferred when available. */
  tricksTaken?: number | null;
  /**
   * Bridgemate-style relative result: "=", "+1", "-2", or empty for PASS.
   * Used when tricksTaken is not set.
   */
  tricksResult?: string | null;
  vulnerability: Vulnerability;
};

const TRICK_SCORES: Record<Exclude<ContractDenomination, "PASS">, number> = {
  CLUBS: 20,
  DIAMONDS: 20,
  HEARTS: 30,
  SPADES: 30,
  NT: 30,
};

function isVulnerable(
  vulnerability: Vulnerability,
  declarer: Declarer,
): boolean {
  if (vulnerability === "BOTH") return true;
  if (vulnerability === "NONE") return false;
  const ns = declarer === "N" || declarer === "S";
  if (vulnerability === "NS") return ns;
  if (vulnerability === "EW") return !ns;
  return false;
}

function nsPerspective(declarer: Declarer, declarerScore: number): number {
  if (declarer === "N" || declarer === "S") return declarerScore;
  return -declarerScore;
}

/** Tricks needed to make contract of level L = 6 + L */
export function tricksNeeded(level: number): number {
  return 6 + level;
}

export function resolveTricksTaken(input: {
  contractLevel: number | null;
  contractDenomination: ContractDenomination | null;
  tricksTaken?: number | null;
  tricksResult?: string | null;
}): number | null {
  if (input.contractDenomination === "PASS" || input.contractLevel === 0) {
    return 0;
  }
  if (input.tricksTaken != null && Number.isInteger(input.tricksTaken)) {
    return input.tricksTaken;
  }
  if (input.contractLevel == null || input.contractDenomination == null) {
    return null;
  }
  const needed = tricksNeeded(input.contractLevel);
  const raw = (input.tricksResult ?? "").trim();
  if (raw === "" || raw.toUpperCase() === "PASS") return null;
  if (raw === "=") return needed;
  const m = raw.match(/^([+-])(\d+)$/);
  if (!m) return null;
  const delta = Number(m[2]);
  return m[1] === "+" ? needed + delta : needed - delta;
}

/**
 * Compute raw score from NS perspective (PRD §4.6).
 * Pass-out → 0. Returns null when contract cannot be scored.
 */
export function computeNsContractScore(input: ContractScoreInput): number | null {
  if (input.contractDenomination === "PASS" || input.contractLevel === 0) {
    return 0;
  }
  if (
    input.contractLevel == null ||
    input.contractDenomination == null ||
    input.declarer == null
  ) {
    return null;
  }
  if (input.contractLevel < 1 || input.contractLevel > 7) return null;

  const tricks = resolveTricksTaken(input);
  if (tricks == null || tricks < 0 || tricks > 13) return null;

  const level = input.contractLevel;
  const denom = input.contractDenomination;

  const needed = tricksNeeded(level);
  const vul = isVulnerable(input.vulnerability, input.declarer);
  const doubling = input.doubling ?? "NONE";

  let declarerScore: number;

  if (tricks >= needed) {
    // Made
    const overtricks = tricks - needed;
    let trickScore: number;
    if (denom === "NT") {
      trickScore = 40 + (level - 1) * 30;
    } else {
      trickScore = level * TRICK_SCORES[denom];
    }

    if (doubling === "DOUBLED") trickScore *= 2;
    if (doubling === "REDOUBLED") trickScore *= 4;

    let overtrickScore = 0;
    if (doubling === "NONE") {
      overtrickScore = overtricks * TRICK_SCORES[denom === "NT" ? "NT" : denom];
      if (denom === "NT") {
        // NT overtricks are 30 each (same as TRICK_SCORES.NT)
        overtrickScore = overtricks * 30;
      }
    } else if (doubling === "DOUBLED") {
      overtrickScore = overtricks * (vul ? 200 : 100);
    } else {
      overtrickScore = overtricks * (vul ? 400 : 200);
    }

    let gameBonus = 0;
    if (trickScore >= 100) {
      gameBonus = vul ? 500 : 300;
    } else {
      gameBonus = 50; // part-score
    }

    let slamBonus = 0;
    if (level === 6) slamBonus = vul ? 750 : 500;
    if (level === 7) slamBonus = vul ? 1500 : 1000;

    let insult = 0;
    if (doubling === "DOUBLED") insult = 50;
    if (doubling === "REDOUBLED") insult = 100;

    declarerScore = trickScore + overtrickScore + gameBonus + slamBonus + insult;
  } else {
    // Down
    const undertricks = needed - tricks;
    if (doubling === "NONE") {
      declarerScore = -(undertricks * (vul ? 100 : 50));
    } else if (doubling === "DOUBLED") {
      // 1st: 100/200, 2nd-3rd: 200/300, 4+: 300/300
      let total = 0;
      for (let i = 1; i <= undertricks; i++) {
        if (i === 1) total += vul ? 200 : 100;
        else if (i <= 3) total += vul ? 300 : 200;
        else total += 300;
      }
      declarerScore = -total;
    } else {
      // redoubled = double of doubled undertrick schedule
      let total = 0;
      for (let i = 1; i <= undertricks; i++) {
        if (i === 1) total += vul ? 400 : 200;
        else if (i <= 3) total += vul ? 600 : 400;
        else total += 600;
      }
      declarerScore = -total;
    }
  }

  return nsPerspective(input.declarer, declarerScore);
}
