import type { SupabaseClient } from "@supabase/supabase-js";
import { getWbfVpBands } from "@/lib/scoring/wbf-vp-generator";

export class VpLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VpLookupError";
  }
}

export type VpResult = {
  vpHome: number;
  vpAway: number;
};

export type LookupVpParams = {
  groupId: string;
  boardCount: number;
  impsHome: number;
  impsAway: number;
  /** When true (default), use WBF continuous scale if no DB table exists. */
  allowWbfFallback?: boolean;
};

export type VpTableRow = {
  imp_min: number;
  imp_max: number;
  vp_home: number;
  vp_away: number;
};

/** Net IMP = home - away; find matching VP band for group + board count. */
export function findVpBand(
  rows: VpTableRow[],
  impsHome: number,
  impsAway: number,
): VpResult {
  const net = impsHome - impsAway;
  const row = rows.find((r) => net >= r.imp_min && net <= r.imp_max);
  if (!row) {
    throw new VpLookupError(
      `No VP band for net IMP ${net} (${impsHome} - ${impsAway})`,
    );
  }
  return { vpHome: Number(row.vp_home), vpAway: Number(row.vp_away) };
}

/** Look up VPs from DB; optionally fall back to generated WBF bands. */
export async function lookupVp(
  supabase: SupabaseClient,
  params: LookupVpParams,
): Promise<VpResult> {
  const {
    groupId,
    boardCount,
    impsHome,
    impsAway,
    allowWbfFallback = true,
  } = params;

  if (!(boardCount > 0) || !Number.isFinite(boardCount)) {
    throw new VpLookupError(`Invalid board count for VP lookup: ${boardCount}`);
  }

  const { data: table, error: tableError } = await supabase
    .from("vp_tables")
    .select("id")
    .eq("group_id", groupId)
    .eq("board_count", boardCount)
    .maybeSingle();

  if (tableError) throw tableError;

  if (table) {
    const { data: rows, error: rowsError } = await supabase
      .from("vp_table_rows")
      .select("imp_min, imp_max, vp_home, vp_away")
      .eq("vp_table_id", table.id);

    if (rowsError) throw rowsError;
    if (!rows?.length) {
      throw new VpLookupError(`VP table ${table.id} has no rows`);
    }

    return findVpBand(rows as VpTableRow[], impsHome, impsAway);
  }

  if (!allowWbfFallback) {
    throw new VpLookupError(
      `No VP table for group ${groupId} with ${boardCount} boards`,
    );
  }

  return findVpBand(getWbfVpBands(boardCount), impsHome, impsAway);
}

export async function lookupVpForMatch(
  supabase: SupabaseClient,
  matchId: string,
  impsHome: number,
  impsAway: number,
): Promise<VpResult> {
  const { data, error } = await supabase.rpc("lookup_vp_for_match", {
    p_match_id: matchId,
    p_imps_home: impsHome,
    p_imps_away: impsAway,
  });

  if (error) throw new VpLookupError(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new VpLookupError("No VP result returned");
  }

  return {
    vpHome: Number(row.vp_home),
    vpAway: Number(row.vp_away),
  };
}
