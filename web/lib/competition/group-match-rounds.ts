import type { SupabaseClient } from "@supabase/supabase-js";
import { applyMatchDatesDivisionFilter } from "@/lib/competition/match-dates-query";
import {
  usesRbbfTemplate,
  type ScheduleSlotRow,
} from "@/lib/competition/group-schedule-slots";

export const REGIONAL_CALENDAR_ROUNDS = 14;

export type RegionalDateRow = {
  round: number;
  datetime: string;
};

export type GroupMatchRoundConfig = {
  applicable: boolean;
  scope: string;
  roundCount: number;
  effectiveTeamCount: number;
  regionalDates: RegionalDateRow[];
  skippedRounds: number[];
  usedRounds: number[];
  hasCustomSkips: boolean;
  selectionComplete: boolean;
};

export function defaultSkippedRounds(roundCount: number): number[] {
  if (roundCount >= REGIONAL_CALENDAR_ROUNDS) return [];
  return Array.from(
    { length: REGIONAL_CALENDAR_ROUNDS - roundCount },
    (_, i) => roundCount + 1 + i,
  );
}

export function usedRoundsFromSkipped(
  roundCount: number,
  skipped: number[],
): number[] {
  const skipSet = new Set(skipped);
  const used: number[] = [];
  for (let r = 1; r <= REGIONAL_CALENDAR_ROUNDS; r++) {
    if (!skipSet.has(r)) used.push(r);
  }
  return used;
}

export function validateSkippedRounds(
  roundCount: number,
  skipped: number[],
): string | null {
  if (roundCount >= REGIONAL_CALENDAR_ROUNDS) {
    return skipped.length > 0
      ? "All 14 regional dates are used for this group"
      : null;
  }

  const expectedSkips = REGIONAL_CALENDAR_ROUNDS - roundCount;
  if (skipped.length !== expectedSkips) {
    return `Expected ${expectedSkips} skipped dates (${roundCount} used of 14)`;
  }

  const seen = new Set<number>();
  for (const round of skipped) {
    if (round < 1 || round > REGIONAL_CALENDAR_ROUNDS) {
      return `Invalid calendar round: ${round}`;
    }
    if (seen.has(round)) {
      return `Duplicate skipped round: ${round}`;
    }
    seen.add(round);
  }

  const used = usedRoundsFromSkipped(roundCount, skipped);
  if (used.length !== roundCount) {
    return `Skipped dates must leave exactly ${roundCount} used rounds`;
  }

  return null;
}

export function needsSkippedDateSelection(
  scope: string,
  roundCount: number,
  usesRbbf: boolean,
): boolean {
  return scope === "regional" && !usesRbbf && roundCount < REGIONAL_CALENDAR_ROUNDS;
}

export function effectiveTeamCount(
  scope: string,
  teamCount: number,
  slots: ScheduleSlotRow[],
): number {
  if (usesRbbfTemplate(scope, teamCount, slots)) return 8;
  return teamCount;
}

export function isSelectionComplete(
  roundCount: number,
  usedRounds: number[],
): boolean {
  return usedRounds.length === roundCount;
}

async function loadGroupContext(supabase: SupabaseClient, groupId: string) {
  const { data: groupRow, error: groupError } = await supabase
    .from("groups")
    .select(
      `
      round_count,
      round_robin_count,
      division:divisions (
        league:leagues (season_id, scope, region_id)
      )
    `,
    )
    .eq("id", groupId)
    .single();

  if (groupError) throw new Error(groupError.message);

  const division = Array.isArray(groupRow.division)
    ? groupRow.division[0]
    : groupRow.division;
  const leagueRow = division?.league;
  const league = (Array.isArray(leagueRow) ? leagueRow[0] : leagueRow) as
    | { season_id: string; scope: string; region_id: string | null }
    | undefined;

  if (!league) throw new Error("Group league not found");

  const { count: teamCount, error: teamsError } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);

  if (teamsError) throw new Error(teamsError.message);

  const { data: slotRows, error: slotsError } = await supabase
    .from("group_schedule_slots")
    .select("slot, team_id, is_bye")
    .eq("group_id", groupId)
    .order("slot");

  if (slotsError) throw new Error(slotsError.message);

  const slots: ScheduleSlotRow[] = (slotRows ?? []).map((r) => ({
    slot: r.slot,
    teamId: r.team_id,
    isBye: r.is_bye,
  }));

  return {
    roundCount: groupRow.round_count ?? 14,
    league,
    teamCount: teamCount ?? 0,
    slots,
    usesRbbf: usesRbbfTemplate(league.scope, teamCount ?? 0, slots),
  };
}

async function loadRegionalDates(
  supabase: SupabaseClient,
  groupId: string,
  league: { season_id: string; scope: string; region_id: string | null },
): Promise<RegionalDateRow[]> {
  const { data: datesDivisionId, error: resolveError } = await supabase.rpc(
    "resolve_group_match_dates_division_id",
    { p_group_id: groupId },
  );
  if (resolveError) throw new Error(resolveError.message);

  let datesQuery = supabase
    .from("competition_match_dates")
    .select("round, datetime")
    .eq("season_id", league.season_id)
    .eq("scope", league.scope)
    .order("round");

  datesQuery =
    league.scope === "national"
      ? datesQuery.is("region_id", null)
      : datesQuery.eq("region_id", league.region_id!);

  datesQuery = applyMatchDatesDivisionFilter(datesQuery, datesDivisionId);

  const { data: dates, error: datesError } = await datesQuery;
  if (datesError) throw new Error(datesError.message);

  return (dates ?? []).map((d) => ({ round: d.round, datetime: d.datetime }));
}

export async function loadGroupMatchRoundConfig(
  supabase: SupabaseClient,
  groupId: string,
): Promise<GroupMatchRoundConfig> {
  const ctx = await loadGroupContext(supabase, groupId);
  const regionalDates = await loadRegionalDates(supabase, groupId, ctx.league);

  const { data: skippedRows, error: skippedError } = await supabase
    .from("group_skipped_match_rounds")
    .select("round")
    .eq("group_id", groupId)
    .order("round");

  if (skippedError) throw new Error(skippedError.message);

  const hasCustomSkips = (skippedRows?.length ?? 0) > 0;
  const skippedRounds = hasCustomSkips
    ? (skippedRows ?? []).map((r) => r.round)
    : defaultSkippedRounds(ctx.roundCount);

  const { data: usedFromDb, error: usedError } = await supabase.rpc(
    "group_used_match_rounds",
    { p_group_id: groupId },
  );
  if (usedError) throw new Error(usedError.message);

  const usedRounds = (usedFromDb as number[] | null) ?? [];
  const applicable = needsSkippedDateSelection(
    ctx.league.scope,
    ctx.roundCount,
    ctx.usesRbbf,
  );

  return {
    applicable,
    scope: ctx.league.scope,
    roundCount: ctx.roundCount,
    effectiveTeamCount: effectiveTeamCount(
      ctx.league.scope,
      ctx.teamCount,
      ctx.slots,
    ),
    regionalDates,
    skippedRounds,
    usedRounds,
    hasCustomSkips,
    selectionComplete: isSelectionComplete(ctx.roundCount, usedRounds),
  };
}

export async function saveGroupSkippedRounds(
  supabase: SupabaseClient,
  groupId: string,
  skippedRounds: number[],
): Promise<void> {
  const ctx = await loadGroupContext(supabase, groupId);

  if (!needsSkippedDateSelection(ctx.league.scope, ctx.roundCount, ctx.usesRbbf)) {
    throw new Error("Match round selection does not apply to this group");
  }

  const validationError = validateSkippedRounds(ctx.roundCount, skippedRounds);
  if (validationError) throw new Error(validationError);

  const { count: matchCount, error: matchError } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);

  if (matchError) throw new Error(matchError.message);
  if ((matchCount ?? 0) > 0) {
    throw new Error("Cannot change match dates after fixtures are generated");
  }

  const { error: deleteError } = await supabase
    .from("group_skipped_match_rounds")
    .delete()
    .eq("group_id", groupId);

  if (deleteError) throw new Error(deleteError.message);

  const defaultSkipped = defaultSkippedRounds(ctx.roundCount);
  const isDefault =
    skippedRounds.length === defaultSkipped.length &&
    [...skippedRounds].sort((a, b) => a - b).join(",") ===
      defaultSkipped.join(",");

  if (isDefault || skippedRounds.length === 0) return;

  const { error: insertError } = await supabase
    .from("group_skipped_match_rounds")
    .insert(
      skippedRounds.map((round) => ({
        group_id: groupId,
        round,
      })),
    );

  if (insertError) throw new Error(insertError.message);
}

export async function fetchGroupFixtureRoundDates(
  supabase: SupabaseClient,
  groupId: string,
  league: { season_id: string; scope: string; region_id: string | null },
  roundCount: number,
): Promise<{ round: number; datetime: string }[]> {
  const regionalDates = await loadRegionalDates(supabase, groupId, league);
  const dateByCalendarRound = new Map(
    regionalDates.map((d) => [d.round, d.datetime]),
  );

  if (league.scope === "national") {
    if (regionalDates.length < roundCount) {
      throw new Error(`Missing competition match dates (need ${roundCount})`);
    }
    return regionalDates.slice(0, roundCount).map((d) => ({
      round: d.round,
      datetime: d.datetime,
    }));
  }

  if (regionalDates.length < REGIONAL_CALENDAR_ROUNDS) {
    throw new Error(
      `Missing regional competition match dates (need ${REGIONAL_CALENDAR_ROUNDS})`,
    );
  }

  const { data: usedRounds, error: usedError } = await supabase.rpc(
    "group_used_match_rounds",
    { p_group_id: groupId },
  );
  if (usedError) throw new Error(usedError.message);

  const used = (usedRounds as number[] | null) ?? [];
  if (used.length !== roundCount) {
    throw new Error(
      `Group match round selection invalid (need ${roundCount} used rounds, found ${used.length})`,
    );
  }

  return used.map((calendarRound) => {
    const datetime = dateByCalendarRound.get(calendarRound);
    if (!datetime) {
      throw new Error(`Missing datetime for calendar round ${calendarRound}`);
    }
    return { round: calendarRound, datetime };
  });
}
