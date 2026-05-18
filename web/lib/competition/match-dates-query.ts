import type { SupabaseClient } from "@supabase/supabase-js";
import type { NationalScheduleKey } from "./national-structure";
import { resolveNationalScheduleDivisionId } from "./ensure-national-structure";

export async function nationalMatchDatesDivisionId(
  supabase: SupabaseClient,
  seasonId: string,
  scheduleKey: NationalScheduleKey,
): Promise<string | null> {
  return resolveNationalScheduleDivisionId(supabase, seasonId, scheduleKey);
}

export function applyMatchDatesDivisionFilter<
  Q extends {
    is: (col: string, value: null) => Q;
    eq: (col: string, value: string) => Q;
  },
>(query: Q, divisionId: string | null): Q {
  return divisionId === null
    ? query.is("division_id", null)
    : query.eq("division_id", divisionId);
}
