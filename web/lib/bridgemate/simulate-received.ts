/**
 * Deterministic Bridgemate ReceivedData simulation from a BWS session plan.
 */

import type { BwsSessionPlan } from "@/lib/bridgemate/bws-session";
import type { BwsReceivedDataInsert } from "@/lib/bridgemate/write-bws";

const CONTRACTS = [
  "1C",
  "1D",
  "1H",
  "1S",
  "1NT",
  "2C",
  "2D",
  "2H",
  "2S",
  "2NT",
  "3C",
  "3D",
  "3H",
  "3S",
  "3NT",
  "4H",
  "4S",
  "4NT",
  "5C",
  "5D",
  "6H",
  "6S",
  "3HX",
  "4SX",
  "PASS",
] as const;

const RESULTS = ["=", "=", "=", "+1", "+1", "-1", "+2", "-2", "-3"] as const;
const LEADS = ["SA", "HK", "DQ", "CJ", "S2", "H3", "D4", "C5"] as const;

/** Mulberry32 — stable per-seed PRNG for reproducible fixtures. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

/**
 * One result per (table, board) in RoundData. Open/closed tables diverge
 * so Butler comparisons are non-trivial.
 */
export function simulateReceivedDataFromPlan(
  plan: BwsSessionPlan,
  options?: { seed?: number; now?: Date },
): BwsReceivedDataInsert[] {
  const seed = options?.seed ?? 20260918;
  const now = options?.now ?? new Date();
  const rows: BwsReceivedDataInsert[] = [];
  let id = 1;

  for (const rd of plan.roundData) {
    for (let board = rd.lowBoard; board <= rd.highBoard; board++) {
      const rand = mulberry32(
        seed ^ (rd.table * 10_000 + board * 17 + rd.nsPair * 31),
      );
      const contract = pick(rand, CONTRACTS);
      const isPass = contract === "PASS";
      const declarer = isPass ? null : 1 + Math.floor(rand() * 4);
      const nsEw =
        declarer == null
          ? null
          : declarer === 1 || declarer === 3
            ? "NS"
            : "EW";

      rows.push({
        ID: id++,
        Section: rd.section,
        Table: rd.table,
        Round: rd.round,
        Board: board,
        PairNS: rd.nsPair,
        PairEW: rd.ewPair,
        Declarer: declarer,
        "NS/EW": nsEw,
        Contract: contract,
        Result: isPass ? "" : pick(rand, RESULTS),
        LeadCard: isPass ? null : pick(rand, LEADS),
        Remarks: null,
        DateLog: now,
        TimeLog: now,
        Processed: false,
        ExternalUpdate: false,
        Processed1: false,
        Processed2: false,
        Processed3: false,
        Processed4: false,
        Erased: false,
        SuspiciousContract: 0,
      });
    }
  }

  return rows;
}
