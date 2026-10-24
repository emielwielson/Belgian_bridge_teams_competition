import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveNationalScheduleDivisionId } from "./ensure-national-structure";
import {
  collapseRoundsToMatchDays,
  honorMatchDayIndexForRound,
  NATIONAL_MATCH_DAY_COUNTS,
} from "./national-match-schedule";
import {
  applyMatchDatesDivisionFilter,
  nationalMatchDatesDivisionId,
} from "./match-dates-query";

export const HONOR_MATCH_DAY_COUNT = NATIONAL_MATCH_DAY_COUNTS.honor;

export type HonorMatchDayVenue = {
  matchDayIndex: number;
  location: string | null;
};

function emptyVenues(): HonorMatchDayVenue[] {
  return Array.from({ length: HONOR_MATCH_DAY_COUNT }, (_, i) => ({
    matchDayIndex: i + 1,
    location: null,
  }));
}

export function normalizeHonorVenueInputs(venues: unknown): string[] | null {
  if (!Array.isArray(venues) || venues.length !== HONOR_MATCH_DAY_COUNT) {
    return null;
  }
  const normalized: string[] = [];
  for (const value of venues) {
    if (typeof value !== "string") return null;
    normalized.push(value.trim());
  }
  return normalized;
}

export function honorVenuesComplete(venues: HonorMatchDayVenue[]): boolean {
  return venues.every(
    (v) => typeof v.location === "string" && v.location.trim().length > 0,
  );
}

export async function resolveHonorDivisionId(
  supabase: SupabaseClient,
  seasonId: string,
): Promise<string | null> {
  return resolveNationalScheduleDivisionId(supabase, seasonId, "honor");
}

export async function loadHonorMatchDayVenues(
  supabase: SupabaseClient,
  divisionId: string,
): Promise<HonorMatchDayVenue[]> {
  const { data, error } = await supabase
    .from("division_match_day_venues")
    .select("match_day_index, location")
    .eq("division_id", divisionId);

  if (error) throw error;

  const byDay = new Map<number, string>();
  for (const row of data ?? []) {
    const index = Number(row.match_day_index);
    const location =
      typeof row.location === "string" ? row.location.trim() : "";
    if (index >= 1 && index <= HONOR_MATCH_DAY_COUNT && location) {
      byDay.set(index, location);
    }
  }

  return emptyVenues().map((slot) => ({
    matchDayIndex: slot.matchDayIndex,
    location: byDay.get(slot.matchDayIndex) ?? null,
  }));
}

export async function loadHonorMatchDays(
  supabase: SupabaseClient,
  seasonId: string,
): Promise<string[]> {
  const divisionId = await nationalMatchDatesDivisionId(
    supabase,
    seasonId,
    "honor",
  );
  let datesQuery = supabase
    .from("competition_match_dates")
    .select("round, datetime")
    .eq("season_id", seasonId)
    .eq("scope", "national")
    .is("region_id", null)
    .order("round");
  datesQuery = applyMatchDatesDivisionFilter(datesQuery, divisionId);
  const { data, error } = await datesQuery;
  if (error) throw error;
  return collapseRoundsToMatchDays("honor", data ?? []);
}

export async function saveHonorMatchDayVenues(
  supabase: SupabaseClient,
  divisionId: string,
  venues: string[],
): Promise<HonorMatchDayVenue[]> {
  if (venues.length !== HONOR_MATCH_DAY_COUNT) {
    throw new Error(
      `Expected ${HONOR_MATCH_DAY_COUNT} venues, got ${venues.length}`,
    );
  }

  const toUpsert: { division_id: string; match_day_index: number; location: string }[] =
    [];
  const toClear: number[] = [];

  for (let i = 0; i < venues.length; i++) {
    const matchDayIndex = i + 1;
    const location = venues[i]?.trim() ?? "";
    if (location) {
      toUpsert.push({
        division_id: divisionId,
        match_day_index: matchDayIndex,
        location,
      });
    } else {
      toClear.push(matchDayIndex);
    }
  }

  if (toClear.length > 0) {
    const { error: deleteError } = await supabase
      .from("division_match_day_venues")
      .delete()
      .eq("division_id", divisionId)
      .in("match_day_index", toClear);
    if (deleteError) throw deleteError;
  }

  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from("division_match_day_venues")
      .upsert(toUpsert, { onConflict: "division_id,match_day_index" });
    if (upsertError) throw upsertError;
  }

  return loadHonorMatchDayVenues(supabase, divisionId);
}

/**
 * Resolve the Honor venue for a match from its group + round.
 * Returns null when unset or when the group is not under a known division.
 */
export async function loadHonorMatchVenue(
  supabase: SupabaseClient,
  match: { group_id: string; round: number },
): Promise<string | null> {
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("division_id")
    .eq("id", match.group_id)
    .maybeSingle();
  if (groupError) throw groupError;
  if (!group?.division_id) return null;

  let matchDayIndex: number;
  try {
    matchDayIndex = honorMatchDayIndexForRound(match.round);
  } catch {
    return null;
  }

  const { data, error } = await supabase
    .from("division_match_day_venues")
    .select("location")
    .eq("division_id", group.division_id)
    .eq("match_day_index", matchDayIndex)
    .maybeSingle();
  if (error) throw error;

  const location =
    typeof data?.location === "string" ? data.location.trim() : "";
  return location || null;
}
