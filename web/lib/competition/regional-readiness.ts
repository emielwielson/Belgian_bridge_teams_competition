import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildScheduleSlotsState,
  seedGroupScheduleSlotsIfEmpty,
  slotsAreComplete,
} from "./group-schedule-slots";
import {
  loadGroupMatchRoundConfig,
  REGIONAL_CALENDAR_ROUNDS,
} from "./group-match-rounds";
import { REGIONAL_MATCH_DAY_COUNT } from "./regional-match-schedule";
import { type RegionCode } from "./scopes";

export const REGIONAL_MIN_TEAMS = 2;
export const REGIONAL_SLOT_TEAM_MIN = 7;
export const REGIONAL_SLOT_TEAM_MAX = 8;

export type CalendarReadiness = {
  required: number;
  set: number;
  complete: boolean;
};

export type GroupReadiness = {
  divisionName: string;
  groupName: string;
  groupId: string;
  teamCount: number;
  roundCount: number;
  matchesCount: number;
  teamsComplete: boolean;
  datesComplete: boolean;
  slotsComplete: boolean;
  scheduleComplete: boolean;
  groupReady: boolean;
};

export type RegionalReadiness = {
  seasonStatus: string;
  regionCode: RegionCode;
  leagueId: string | null;
  calendar: CalendarReadiness;
  groups: GroupReadiness[];
  allGroupsReady: boolean;
  allSchedulesReady: boolean;
  canStartLeague: boolean;
  blockers: string[];
};

export function countRegionalCalendarDates(roundCount: number): CalendarReadiness {
  const required = REGIONAL_MATCH_DAY_COUNT;
  const set = Math.min(roundCount, required);
  return {
    required,
    set,
    complete: roundCount >= required,
  };
}

export function groupTeamsComplete(group: GroupReadiness): boolean {
  if (group.teamCount >= REGIONAL_SLOT_TEAM_MIN && group.teamCount <= REGIONAL_SLOT_TEAM_MAX) {
    return group.slotsComplete;
  }
  return group.teamCount >= REGIONAL_MIN_TEAMS;
}

export function groupLabel(group: GroupReadiness): string {
  return `${group.divisionName} — ${group.groupName}`;
}

export function groupTeamsStatusLabel(group: GroupReadiness): string {
  if (group.teamCount >= REGIONAL_SLOT_TEAM_MIN && group.teamCount <= REGIONAL_SLOT_TEAM_MAX) {
    if (group.teamCount === 7 && group.slotsComplete) {
      return "7/8 teams (+ bye)";
    }
    return `${group.teamCount}/8 teams`;
  }
  return `${group.teamCount} teams (min ${REGIONAL_MIN_TEAMS})`;
}

export function buildRegionalReadiness(input: {
  seasonStatus: string;
  regionCode: RegionCode;
  leagueId: string | null;
  calendarRoundCount: number;
  groups: GroupReadiness[];
}): RegionalReadiness {
  const calendar = countRegionalCalendarDates(input.calendarRoundCount);

  const groupsWithReady = input.groups.map((g) => ({
    ...g,
    groupReady: groupTeamsComplete(g) && g.datesComplete,
  }));

  const allGroupsReady =
    groupsWithReady.length > 0 && groupsWithReady.every((g) => g.groupReady);

  const allSchedulesReady =
    groupsWithReady.length > 0 &&
    groupsWithReady.every((g) => g.scheduleComplete);

  const blockers: string[] = [];

  if (input.seasonStatus !== "setup") {
    blockers.push("Season is no longer in setup.");
  }

  if (!input.leagueId) {
    blockers.push("Regional league is not set up yet.");
  }

  if (!calendar.complete) {
    blockers.push(
      `Regional match days: ${calendar.set}/${calendar.required} complete.`,
    );
  }

  if (groupsWithReady.length === 0) {
    blockers.push("Add at least one division and group with teams.");
  }

  for (const group of groupsWithReady) {
    if (group.groupReady) continue;
    const label = groupLabel(group);
    if (!groupTeamsComplete(group)) {
      if (
        group.teamCount >= REGIONAL_SLOT_TEAM_MIN &&
        group.teamCount <= REGIONAL_SLOT_TEAM_MAX &&
        !group.slotsComplete
      ) {
        blockers.push(`${label}: schedule slots incomplete.`);
      } else if (group.teamCount < REGIONAL_MIN_TEAMS) {
        blockers.push(
          `${label}: ${groupTeamsStatusLabel(group)} (need at least ${REGIONAL_MIN_TEAMS}).`,
        );
      } else {
        blockers.push(`${label}: ${groupTeamsStatusLabel(group)}.`);
      }
    } else if (!group.datesComplete) {
      blockers.push(`${label}: regional date selection incomplete.`);
    }
  }

  const canStartLeague =
    input.seasonStatus === "setup" &&
    input.leagueId !== null &&
    calendar.complete &&
    allGroupsReady &&
    (allSchedulesReady ||
      groupsWithReady.every((g) => g.matchesCount === 0));

  return {
    seasonStatus: input.seasonStatus,
    regionCode: input.regionCode,
    leagueId: input.leagueId,
    calendar,
    groups: groupsWithReady,
    allGroupsReady,
    allSchedulesReady,
    canStartLeague,
    blockers,
  };
}

export async function fetchRegionalReadiness(
  supabase: SupabaseClient,
  seasonId: string,
  regionCode: RegionCode,
): Promise<RegionalReadiness> {
  const { data: season } = await supabase
    .from("seasons")
    .select("status")
    .eq("id", seasonId)
    .single();

  const seasonStatus = season?.status ?? "setup";

  const { data: region } = await supabase
    .from("regions")
    .select("id")
    .eq("code", regionCode)
    .single();

  if (!region) {
    return buildRegionalReadiness({
      seasonStatus,
      regionCode,
      leagueId: null,
      calendarRoundCount: 0,
      groups: [],
    });
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_id", seasonId)
    .eq("scope", "regional")
    .eq("region_id", region.id)
    .maybeSingle();

  if (!league) {
    return buildRegionalReadiness({
      seasonStatus,
      regionCode,
      leagueId: null,
      calendarRoundCount: 0,
      groups: [],
    });
  }

  const { count: calendarCount } = await supabase
    .from("competition_match_dates")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId)
    .eq("scope", "regional")
    .eq("region_id", region.id)
    .is("division_id", null);

  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("league_id", league.id);

  const divisionIds = divisions?.map((d) => d.id) ?? [];
  const divisionById = new Map(divisions?.map((d) => [d.id, d.name]) ?? []);

  const { data: groupsData } =
    divisionIds.length > 0
      ? await supabase
          .from("groups")
          .select("id, name, division_id, round_count")
          .in("division_id", divisionIds)
      : { data: [] };

  const groups: GroupReadiness[] = [];

  for (const g of groupsData ?? []) {
    const divisionName = divisionById.get(g.division_id) ?? "Division";
    const roundCount = g.round_count ?? REGIONAL_CALENDAR_ROUNDS;

    const { count: teamCount } = await supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("group_id", g.id);

    const { count: matchesCount } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("group_id", g.id);

    const count = teamCount ?? 0;
    let slotsComplete = false;

    if (count >= REGIONAL_SLOT_TEAM_MIN && count <= REGIONAL_SLOT_TEAM_MAX) {
      await seedGroupScheduleSlotsIfEmpty(supabase, g.id);
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id, name")
        .eq("group_id", g.id)
        .order("created_at");
      const { data: slotRows } = await supabase
        .from("group_schedule_slots")
        .select("slot, team_id, is_bye")
        .eq("group_id", g.id)
        .order("slot");
      const slotState = buildScheduleSlotsState(teamRows ?? [], slotRows ?? []);
      slotsComplete = slotsAreComplete(count, slotState.slots);
    }

    const roundConfig = await loadGroupMatchRoundConfig(supabase, g.id);
    const datesComplete = roundConfig.applicable
      ? roundConfig.selectionComplete
      : true;

    const row: GroupReadiness = {
      divisionName,
      groupName: g.name,
      groupId: g.id,
      teamCount: count,
      roundCount,
      matchesCount: matchesCount ?? 0,
      teamsComplete: false,
      datesComplete,
      slotsComplete,
      scheduleComplete: (matchesCount ?? 0) > 0,
      groupReady: false,
    };
    row.teamsComplete = groupTeamsComplete(row);
    row.groupReady = row.teamsComplete && row.datesComplete;
    groups.push(row);
  }

  return buildRegionalReadiness({
    seasonStatus,
    regionCode,
    leagueId: league.id,
    calendarRoundCount: calendarCount ?? 0,
    groups,
  });
}

export class RegionalNotReadyError extends Error {
  readonly status = 400;

  constructor(public blockers: string[]) {
    super(blockers.join(" "));
    this.name = "RegionalNotReadyError";
  }
}

export function assertCanStartRegionalLeague(readiness: RegionalReadiness): void {
  if (!readiness.canStartLeague) {
    throw new RegionalNotReadyError(readiness.blockers);
  }
}
