import type { VpTableRow } from "./vp-lookup";

/** Golden ratio constant used in WBF continuous VP scales. */
const TAU = (Math.sqrt(5) - 1) / 2;
const TAU3 = TAU ** 3;

export type WbfImpVpRow = readonly [imp: number, winnerVp: number, loserVp: number];

function rawWinnerVp(boards: number, margin: number): number {
  const B = 15 * Math.sqrt(boards);
  const M = Math.abs(margin);
  if (M === 0) return 10;
  const vp = 10 + (10 * (1 - TAU ** ((3 * M) / B))) / (1 - TAU3);
  return Math.min(20, vp);
}

function roundVp(vp: number): number {
  return Math.floor(vp * 100 + 0.5) / 100;
}

function blitzImp(boards: number): number {
  for (let imp = 0; imp <= 200; imp++) {
    if (roundVp(rawWinnerVp(boards, imp)) >= 20) return imp;
  }
  return 200;
}

/** Generate WBF continuous IMP→VP rows for a given board count. */
export function generateWbfImpVpTable(boards: number): WbfImpVpRow[] {
  const maxImp = blitzImp(boards);
  const winners: number[] = [];
  for (let imp = 0; imp <= maxImp; imp++) {
    winners.push(roundVp(rawWinnerVp(boards, imp)));
  }

  for (let iter = 0; iter < 20; iter++) {
    let changed = false;
    for (let i = 1; i < winners.length - 1; i++) {
      const d1 = winners[i] - winners[i - 1];
      const d2 = winners[i + 1] - winners[i];
      if (d2 > d1 + 0.0001) {
        winners[i] = roundVp(winners[i] + 0.01);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return winners.map((winner, imp) => [imp, winner, roundVp(20 - winner)] as const);
}

export function buildWbfVpBands(
  impVpTable: ReadonlyArray<readonly [number, number, number]>,
): VpTableRow[] {
  const maxImp = impVpTable[impVpTable.length - 1]?.[0] ?? 0;
  const bands: VpTableRow[] = [
    { imp_min: -999, imp_max: -maxImp, vp_home: 0, vp_away: 20 },
  ];

  for (let i = impVpTable.length - 1; i >= 1; i--) {
    const [imp, winner, loser] = impVpTable[i];
    bands.push({
      imp_min: -imp,
      imp_max: -imp,
      vp_home: loser,
      vp_away: winner,
    });
  }

  const [_, drawHome, drawAway] = impVpTable[0];
  bands.push({ imp_min: 0, imp_max: 0, vp_home: drawHome, vp_away: drawAway });

  for (let i = 1; i < impVpTable.length; i++) {
    const [imp, winner, loser] = impVpTable[i];
    bands.push({
      imp_min: imp,
      imp_max: imp,
      vp_home: winner,
      vp_away: loser,
    });
  }

  bands.push({ imp_min: maxImp, imp_max: 999, vp_home: 20, vp_away: 0 });
  return bands;
}

const bandCache = new Map<number, VpTableRow[]>();

export function getWbfVpBands(boardCount: number): VpTableRow[] {
  const cached = bandCache.get(boardCount);
  if (cached) return cached;

  const impVpTable = generateWbfImpVpTable(boardCount);
  const bands = buildWbfVpBands(impVpTable);
  bandCache.set(boardCount, bands);
  return bands;
}

export const SUPPORTED_WBF_BOARD_COUNTS = [
  12, 15, 16, 20, 21, 24, 28, 32,
] as const;

export function vpTableName(boardCount: number): string {
  return `WBF ${boardCount} boards`;
}
