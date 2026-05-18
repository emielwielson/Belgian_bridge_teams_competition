import type { SupabaseClient } from "@supabase/supabase-js";
import type { VpTableRow } from "./vp-lookup";

/** MVP standard VP ladder for 24-board matches (UAT; verify against RBBF rules). */
export const STANDARD_24_BOARD_VP_BANDS: VpTableRow[] = [
  { imp_min: -999, imp_max: -50, vp_home: 0, vp_away: 24 },
  { imp_min: -49, imp_max: 0, vp_home: 12, vp_away: 12 },
  { imp_min: 1, imp_max: 999, vp_home: 24, vp_away: 0 },
];

export async function ensureStandardVpTable(
  supabase: SupabaseClient,
  groupId: string,
  boardCount = 24,
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
        name: "Standard 24 boards",
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

  const { error: rowsError } = await supabase.from("vp_table_rows").insert(
    STANDARD_24_BOARD_VP_BANDS.map((band) => ({
      vp_table_id: tableId,
      imp_min: band.imp_min,
      imp_max: band.imp_max,
      vp_home: band.vp_home,
      vp_away: band.vp_away,
    })),
  );
  if (rowsError) throw rowsError;
}
