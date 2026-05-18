import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function lookupVp(
  supabase: SupabaseClient,
  params: LookupVpParams,
): Promise<VpResult> {
  const { groupId, boardCount, impsHome, impsAway } = params;

  const { data: table, error: tableError } = await supabase
    .from("vp_tables")
    .select("id")
    .eq("group_id", groupId)
    .eq("board_count", boardCount)
    .maybeSingle();

  if (tableError) throw tableError;
  if (!table) {
    throw new VpLookupError(
      `No VP table for group ${groupId} with ${boardCount} boards`,
    );
  }

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
