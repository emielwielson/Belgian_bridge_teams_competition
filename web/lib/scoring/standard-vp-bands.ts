import type { SupabaseClient } from "@supabase/supabase-js";
import type { VpTableRow } from "./vp-lookup";
import {
  buildWbfVpBands,
  getWbfVpBands,
  SUPPORTED_WBF_BOARD_COUNTS,
  vpTableName,
} from "./wbf-vp-generator";

/**
 * WBF VP scale for 24 boards (winner / loser VP per IMP margin).
 * Source: WBF VP scale 24 boards; net IMP = imps_home - imps_away.
 * Kept as the canonical reference table; other counts are generated via wbf-vp-generator.
 */
export const WBF_24_IMP_VP = [
  [0, 10, 10],
  [1, 10.25, 9.75],
  [2, 10.5, 9.5],
  [3, 10.75, 9.25],
  [4, 10.99, 9.01],
  [5, 11.23, 8.77],
  [6, 11.46, 8.54],
  [7, 11.68, 8.32],
  [8, 11.9, 8.1],
  [9, 12.12, 7.88],
  [10, 12.33, 7.67],
  [11, 12.54, 7.46],
  [12, 12.75, 7.25],
  [13, 12.95, 7.05],
  [14, 13.15, 6.85],
  [15, 13.34, 6.66],
  [16, 13.53, 6.47],
  [17, 13.72, 6.28],
  [18, 13.9, 6.1],
  [19, 14.08, 5.92],
  [20, 14.26, 5.74],
  [21, 14.43, 5.57],
  [22, 14.6, 5.4],
  [23, 14.76, 5.24],
  [24, 14.92, 5.08],
  [25, 15.08, 4.92],
  [26, 15.24, 4.76],
  [27, 15.39, 4.61],
  [28, 15.54, 4.46],
  [29, 15.69, 4.31],
  [30, 15.83, 4.17],
  [31, 15.97, 4.03],
  [32, 16.11, 3.89],
  [33, 16.25, 3.75],
  [34, 16.38, 3.62],
  [35, 16.51, 3.49],
  [36, 16.64, 3.36],
  [37, 16.77, 3.23],
  [38, 16.89, 3.11],
  [39, 17.01, 2.99],
  [40, 17.13, 2.87],
  [41, 17.25, 2.75],
  [42, 17.36, 2.64],
  [43, 17.47, 2.53],
  [44, 17.58, 2.42],
  [45, 17.69, 2.31],
  [46, 17.79, 2.21],
  [47, 17.89, 2.11],
  [48, 17.99, 2.01],
  [49, 18.09, 1.91],
  [50, 18.19, 1.81],
  [51, 18.29, 1.71],
  [52, 18.38, 1.62],
  [53, 18.47, 1.53],
  [54, 18.56, 1.44],
  [55, 18.65, 1.35],
  [56, 18.74, 1.26],
  [57, 18.82, 1.18],
  [58, 18.9, 1.1],
  [59, 18.98, 1.02],
  [60, 19.06, 0.94],
  [61, 19.14, 0.86],
  [62, 19.22, 0.78],
  [63, 19.3, 0.7],
  [64, 19.37, 0.63],
  [65, 19.44, 0.56],
  [66, 19.51, 0.49],
  [67, 19.58, 0.42],
  [68, 19.65, 0.35],
  [69, 19.72, 0.28],
  [70, 19.79, 0.21],
  [71, 19.85, 0.15],
  [72, 19.91, 0.09],
  [73, 19.97, 0.03],
  [74, 20, 0],
] as const satisfies ReadonlyArray<readonly [number, number, number]>;

export function buildStandard24BoardVpBands(): VpTableRow[] {
  return buildWbfVpBands(WBF_24_IMP_VP);
}

export const STANDARD_24_BOARD_VP_BANDS: VpTableRow[] =
  buildStandard24BoardVpBands();

/** @deprecated Use ensureVpTable */
export const ensureStandardVpTable = ensureVpTable;

export async function ensureVpTable(
  supabase: SupabaseClient,
  groupId: string,
  boardCount: number,
): Promise<void> {
  const { data: existing, error: lookupError } = await supabase
    .from("vp_tables")
    .select("id")
    .eq("group_id", groupId)
    .eq("board_count", boardCount)
    .maybeSingle();

  if (lookupError) throw lookupError;

  let tableId = existing?.id;
  if (!tableId) {
    const { data: created, error: insertError } = await supabase
      .from("vp_tables")
      .insert({
        group_id: groupId,
        board_count: boardCount,
        name: vpTableName(boardCount),
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    tableId = created.id;
  }

  const { count, error: countError } = await supabase
    .from("vp_table_rows")
    .select("id", { count: "exact", head: true })
    .eq("vp_table_id", tableId);

  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  const bands =
    boardCount === 24
      ? STANDARD_24_BOARD_VP_BANDS
      : getWbfVpBands(boardCount);

  const { error: rowsError } = await supabase.from("vp_table_rows").insert(
    bands.map((band) => ({
      vp_table_id: tableId,
      imp_min: band.imp_min,
      imp_max: band.imp_max,
      vp_home: band.vp_home,
      vp_away: band.vp_away,
    })),
  );
  if (rowsError) throw rowsError;
}

export async function ensureVpTablesForGroup(
  supabase: SupabaseClient,
  groupId: string,
  boardCounts: number[],
): Promise<void> {
  for (const boardCount of boardCounts) {
    await ensureVpTable(supabase, groupId, boardCount);
  }
}

export { SUPPORTED_WBF_BOARD_COUNTS };
