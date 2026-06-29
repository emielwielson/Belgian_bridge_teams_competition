import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyMatchDatesDivisionFilter,
  nationalMatchDatesDivisionId,
} from "./match-dates-query";
import { NATIONAL_MATCH_DAY_COUNTS } from "./national-match-schedule";
import {
  NATIONAL_DIVISIONS,
  type NationalScheduleKey,
} from "./national-structure";
import { NATIONAL_LEAGUE_NAME } from "./league-names";
import { NATIONAL_TEAMS_PER_GROUP } from "./national-teams";
import {
  buildScheduleSlotsState,
  seedGroupScheduleSlotsIfEmpty,
  slotsAreComplete,
} from "./group-schedule-slots";

export type CalendarReadiness = {
  required: number;
  set: number;
  complete: boolean;
};

export type DivisionReadiness = {
  name: string;
  groupId: string | null;
  teamCount: number;
  required: number;
  minTeams: number;
  matchesCount: number;
  teamsComplete: boolean;
  slotsComplete: boolean;
  scheduleComplete: boolean;
};

export type NationalReadiness = {
  seasonStatus: string;
  leagueStatus: string;
  setupLocked: boolean;
  leagueId: string | null;
  structureReady: boolean;
  calendars: Record<NationalScheduleKey, CalendarReadiness>;
  divisions: DivisionReadiness[];
  allTeamsReady: boolean;
  allSchedulesReady: boolean;
  canStartLeague: boolean;
  blockers: string[];
};

const SCHEDULE_KEYS: NationalScheduleKey[] = ["honor", "first", "default"];

function slotsPerDay(scheduleKey: NationalScheduleKey): number {
  return scheduleKey === "honor" ? 3 : scheduleKey === "first" ? 2 : 1;
}

export function countSetMatchDays(
  scheduleKey: NationalScheduleKey,
  roundCount: number,
): CalendarReadiness {
  const required = NATIONAL_MATCH_DAY_COUNTS[scheduleKey];
  const expectedRounds = required * slotsPerDay(scheduleKey);
  const set =
    roundCount >= expectedRounds
      ? required
      : Math.floor(roundCount / slotsPerDay(scheduleKey));
  return {
    required,
    set: Math.min(set, required),
    complete: roundCount >= expectedRounds,
  };
}

export function divisionTeamsComplete(div: DivisionReadiness): boolean {
  if (div.groupId === null) return false;
  if (div.teamCount < div.minTeams || div.teamCount > div.required) {
    return false;
  }
  return div.slotsComplete;
}

export function divisionTeamsLabel(div: DivisionReadiness): string {
  if (div.teamCount === 7 && div.slotsComplete) {
    return "7/8 teams (+ bye)";
  }
  return `${div.teamCount}/${div.required} teams`;
}

export function buildNationalReadiness(input: {
  seasonStatus: string;
  leagueStatus?: string;
  leagueId: string | null;
  structureDivisionCount: number;
  structureGroupCount: number;
  calendarRoundCounts: Record<NationalScheduleKey, number>;
  divisions: DivisionReadiness[];
}): NationalReadiness {
  const leagueStatus = input.leagueStatus ?? "setup";
  const setupLocked = leagueStatus !== "setup";
  const calendars = {
    honor: countSetMatchDays("honor", input.calendarRoundCounts.honor),
    first: countSetMatchDays("first", input.calendarRoundCounts.first),
    default: countSetMatchDays("default", input.calendarRoundCounts.default),
  };

  const structureReady =
    input.structureDivisionCount >= NATIONAL_DIVISIONS.length &&
    input.structureGroupCount >= NATIONAL_DIVISIONS.length;

  const allTeamsReady =
    input.divisions.length === NATIONAL_DIVISIONS.length &&
    input.divisions.every(divisionTeamsComplete);

  const allSchedulesReady =
    input.divisions.length === NATIONAL_DIVISIONS.length &&
    input.divisions.every((d) => d.scheduleComplete);

  const blockers: string[] = [];

  if (setupLocked) {
    blockers.push("This competition has already been started.");
  }

  if (!structureReady) {
    blockers.push(
      "National structure is incomplete (need 8 divisions with groups).",
    );
  }

  for (const key of SCHEDULE_KEYS) {
    const cal = calendars[key];
    if (!cal.complete) {
      const label =
        key === "honor"
          ? "Honor Division"
          : key === "first"
            ? "1st Division"
            : "2nd & 3rd divisions";
      blockers.push(
        `${label} match days: ${cal.set}/${cal.required} complete.`,
      );
    }
  }

  for (const div of input.divisions) {
    if (divisionTeamsComplete(div)) continue;
    if (!div.groupId) {
      blockers.push(`${div.name}: group missing.`);
    } else if (div.teamCount < div.minTeams || div.teamCount > div.required) {
      blockers.push(`${div.name}: ${divisionTeamsLabel(div)} (need ${div.minTeams}–${div.required}).`);
    } else if (!div.slotsComplete) {
      blockers.push(`${div.name}: schedule slots incomplete.`);
    } else {
      blockers.push(`${div.name}: ${divisionTeamsLabel(div)}.`);
    }
  }

  if (allTeamsReady && !allSchedulesReady) {
    const missing = input.divisions.filter((d) => !d.scheduleComplete);
    if (missing.length > 0 && missing.length < input.divisions.length) {
      for (const div of missing) {
        blockers.push(`${div.name}: fixtures not generated yet.`);
      }
    }
  }

  const allCalendarsReady = SCHEDULE_KEYS.every((k) => calendars[k].complete);

  const schedulesStartable =
    input.divisions.length === 0 ||
    input.divisions.every((d) => d.matchesCount === 0) ||
    input.divisions.every((d) => d.scheduleComplete) ||
    input.divisions.some((d) => d.scheduleComplete);

  const canStartLeague =
    !setupLocked &&
    structureReady &&
    allCalendarsReady &&
    allTeamsReady &&
    schedulesStartable;

  return {
    seasonStatus: input.seasonStatus,
    leagueStatus,
    setupLocked,
    leagueId: input.leagueId,
    structureReady,
    calendars,
    divisions: input.divisions,
    allTeamsReady,
    allSchedulesReady,
    canStartLeague,
    blockers,
  };
}

function emptyDivisions(): DivisionReadiness[] {
  return NATIONAL_DIVISIONS.map((spec) => ({
    name: spec.name,
    groupId: null,
    teamCount: 0,
    required: NATIONAL_TEAMS_PER_GROUP,
    minTeams: 7,
    matchesCount: 0,
    teamsComplete: false,
    slotsComplete: false,
    scheduleComplete: false,
  }));
}

export async function fetchNationalReadiness(
  supabase: SupabaseClient,
  seasonId: string,
): Promise<NationalReadiness> {
  const { data: season } = await supabase
    .from("seasons")
    .select("status")
    .eq("id", seasonId)
    .single();

  const seasonStatus = season?.status ?? "setup";

  const { data: league } = await supabase
    .from("leagues")
    .select("id, status")
    .eq("season_id", seasonId)
    .eq("scope", "national")
    .eq("name", NATIONAL_LEAGUE_NAME)
    .maybeSingle();

  const leagueStatus = league?.status ?? "setup";

  if (!league) {
    return buildNationalReadiness({
      seasonStatus,
      leagueStatus,
      leagueId: null,
      structureDivisionCount: 0,
      structureGroupCount: 0,
      calendarRoundCounts: { honor: 0, first: 0, default: 0 },
      divisions: emptyDivisions(),
    });
  }

  const { data: divisionsData } = await supabase
    .from("divisions")
    .select("id, name")
    .eq("league_id", league.id);

  const divisionIds = divisionsData?.map((d) => d.id) ?? [];

  const { data: groups } =
    divisionIds.length > 0
      ? await supabase
          .from("groups")
          .select("id, name, division_id")
          .in("division_id", divisionIds)
      : { data: [] };

  const calendarRoundCounts: Record<NationalScheduleKey, number> = {
    honor: 0,
    first: 0,
    default: 0,
  };

  for (const key of SCHEDULE_KEYS) {
    const divisionId = await nationalMatchDatesDivisionId(
      supabase,
      seasonId,
      key,
    );
    let datesQuery = supabase
      .from("competition_match_dates")
      .select("id", { count: "exact", head: true })
      .eq("season_id", seasonId)
      .eq("scope", "national")
      .is("region_id", null);

    datesQuery = applyMatchDatesDivisionFilter(datesQuery, divisionId);
    const { count } = await datesQuery;
    calendarRoundCounts[key] = count ?? 0;
  }

  const groupByDivisionName = new Map<string, { id: string }>();
  for (const g of groups ?? []) {
    const div = divisionsData?.find((d) => d.id === g.division_id);
    if (div) groupByDivisionName.set(div.name, { id: g.id });
  }

  const divisions: DivisionReadiness[] = [];

  for (const spec of NATIONAL_DIVISIONS) {
    const group = groupByDivisionName.get(spec.name);
    let teamCount = 0;
    let matchesCount = 0;

    if (group) {
      const { count: teams } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("group_id", group.id);
      teamCount = teams ?? 0;

      const { count: matches } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("group_id", group.id);
      matchesCount = matches ?? 0;
    }

    let slotsComplete = false;
    if (group && teamCount >= 7 && teamCount <= 8) {
      await seedGroupScheduleSlotsIfEmpty(supabase, group.id);
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id, name")
        .eq("group_id", group.id)
        .order("created_at");
      const { data: slotRows } = await supabase
        .from("group_schedule_slots")
        .select("slot, team_id, is_bye")
        .eq("group_id", group.id)
        .order("slot");
      const slotState = buildScheduleSlotsState(teamRows ?? [], slotRows ?? []);
      slotsComplete = slotsAreComplete(teamCount, slotState.slots);
    }

    const row: DivisionReadiness = {
      name: spec.name,
      groupId: group?.id ?? null,
      teamCount,
      required: NATIONAL_TEAMS_PER_GROUP,
      minTeams: 7,
      matchesCount,
      teamsComplete: false,
      slotsComplete,
      scheduleComplete: matchesCount > 0,
    };
    row.teamsComplete = divisionTeamsComplete(row);
    divisions.push(row);
  }

  return buildNationalReadiness({
    seasonStatus,
    leagueStatus,
    leagueId: league.id,
    structureDivisionCount: divisionsData?.length ?? 0,
    structureGroupCount: groups?.length ?? 0,
    calendarRoundCounts,
    divisions,
  });
}

export class NationalNotReadyError extends Error {
  readonly status = 400;

  constructor(public blockers: string[]) {
    super(blockers.join(" "));
    this.name = "NationalNotReadyError";
  }
}

export function assertCanStartNationalLeague(readiness: NationalReadiness): void {
  if (!readiness.canStartLeague) {
    throw new NationalNotReadyError(readiness.blockers);
  }
}
