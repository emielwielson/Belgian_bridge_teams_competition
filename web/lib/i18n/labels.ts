import { LEAGUE_NAMES } from "@/lib/competition/league-names";
import {
  divisionTeamsComplete,
  divisionTeamsLabel,
  type NationalReadiness,
} from "@/lib/competition/national-readiness";
import {
  groupLabel,
  groupTeamsComplete,
  groupTeamsStatusLabel,
  REGIONAL_MIN_TEAMS,
  type GroupReadiness,
  type RegionalReadiness,
} from "@/lib/competition/regional-readiness";
import {
  NATIONAL_DIVISIONS,
  type NationalScheduleKey,
} from "@/lib/competition/national-structure";
import { REGION_CODES, type RegionCode } from "@/lib/competition/scopes";

const DIVISION_KEYS = [
  "honor",
  "first",
  "secondA",
  "secondB",
  "thirdA",
  "thirdB",
  "thirdC",
  "thirdD",
] as const;

type DivisionKey = (typeof DIVISION_KEYS)[number];

const DIVISION_KEY_BY_NAME: Record<string, DivisionKey> = Object.fromEntries(
  NATIONAL_DIVISIONS.map((spec, index) => [spec.name, DIVISION_KEYS[index]]),
);

type LabelTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function translateDivisionName(
  englishName: string,
  tDivisions: LabelTranslator,
): string {
  const key = DIVISION_KEY_BY_NAME[englishName];
  return key ? tDivisions(key) : englishName;
}

export function translateLeagueName(
  leagueName: string,
  tRegions: LabelTranslator,
): string {
  if (leagueName === LEAGUE_NAMES.NATIONAL) return tRegions("national");
  if (leagueName === LEAGUE_NAMES.FLANDERS) return tRegions("flanders");
  if (leagueName === LEAGUE_NAMES.WALLONIA) return tRegions("wallonia");
  return leagueName;
}

export function translateRegionalScopeTitle(
  regionCode: RegionCode | undefined,
  tAdmin: LabelTranslator,
): string {
  if (regionCode === REGION_CODES.WALLONIA) {
    return tAdmin("walloniaRegional");
  }
  return tAdmin("flandersRegional");
}

export function translateScheduleLabel(
  scheduleKey: NationalScheduleKey,
  tDivisions: LabelTranslator,
): string {
  return tDivisions(`scheduleLabels.${scheduleKey}`);
}

function calendarBlockerKey(
  scheduleKey: NationalScheduleKey,
): "honorDays" | "firstDays" | "secondThirdDays" {
  if (scheduleKey === "honor") return "honorDays";
  if (scheduleKey === "first") return "firstDays";
  return "secondThirdDays";
}

/** Mirror `buildNationalReadiness` blocker messages in the active locale. */
export function buildTranslatedNationalBlockers(
  readiness: NationalReadiness,
  tBlockers: LabelTranslator,
  tDivisions: LabelTranslator,
): string[] {
  const blockers: string[] = [];

  if (readiness.setupLocked) {
    blockers.push(tBlockers("competitionNotSetup"));
  }

  if (!readiness.structureReady) {
    blockers.push(tBlockers("structureIncomplete"));
  }

  const scheduleKeys: NationalScheduleKey[] = ["honor", "first", "default"];
  for (const key of scheduleKeys) {
    const cal = readiness.calendars[key];
    if (!cal.complete) {
      blockers.push(
        tBlockers(calendarBlockerKey(key), {
          set: cal.set,
          required: cal.required,
        }),
      );
    }
  }

  for (const div of readiness.divisions) {
    if (divisionTeamsComplete(div)) continue;
    const divisionName = translateDivisionName(div.name, tDivisions);
    if (!div.groupId) {
      blockers.push(tBlockers("groupMissing", { divisionName }));
    } else if (
      div.teamCount < div.minTeams ||
      div.teamCount > div.required
    ) {
      blockers.push(
        tBlockers("teamsRange", {
          divisionName,
          teamLabel: translateDivisionTeamLabel(div, tBlockers),
          min: div.minTeams,
          max: div.required,
        }),
      );
    } else if (!div.slotsComplete) {
      blockers.push(tBlockers("slotsIncomplete", { divisionName }));
    } else {
      blockers.push(
        tBlockers("teamsIncomplete", {
          divisionName,
          teamLabel: translateDivisionTeamLabel(div, tBlockers),
        }),
      );
    }
  }

  if (readiness.allTeamsReady && !readiness.allSchedulesReady) {
    const missing = readiness.divisions.filter((d) => !d.scheduleComplete);
    if (missing.length > 0 && missing.length < readiness.divisions.length) {
      for (const div of missing) {
        blockers.push(
          tBlockers("fixturesMissing", {
            divisionName: translateDivisionName(div.name, tDivisions),
          }),
        );
      }
    }
  }

  return blockers;
}

function translateDivisionTeamLabel(
  div: NationalReadiness["divisions"][number],
  tBlockers: LabelTranslator,
): string {
  const english = divisionTeamsLabel(div);
  if (english === "7/8 teams (+ bye)") {
    return tBlockers("teamsSevenBye");
  }
  const match = english.match(/^(\d+)\/(\d+) teams$/);
  if (match) {
    return tBlockers("teamsCount", {
      count: Number(match[1]),
      required: Number(match[2]),
    });
  }
  return english;
}

function translateGroupTeamLabel(
  group: GroupReadiness,
  tBlockers: LabelTranslator,
): string {
  const english = groupTeamsStatusLabel(group);
  if (english === "7/8 teams (+ bye)") {
    return tBlockers("teamsSevenBye");
  }
  const eightMatch = english.match(/^(\d+)\/8 teams$/);
  if (eightMatch) {
    return tBlockers("teamsCount", { count: Number(eightMatch[1]) });
  }
  const genericMatch = english.match(/^(\d+) teams \(min (\d+)\)$/);
  if (genericMatch) {
    return tBlockers("teamsGeneric", {
      count: Number(genericMatch[1]),
      min: Number(genericMatch[2]),
    });
  }
  return english;
}

/** Mirror `buildRegionalReadiness` blocker messages in the active locale. */
export function buildTranslatedRegionalBlockers(
  readiness: RegionalReadiness,
  tBlockers: LabelTranslator,
): string[] {
  const blockers: string[] = [];

  if (readiness.setupLocked) {
    blockers.push(tBlockers("competitionNotSetup"));
  }

  if (!readiness.leagueId) {
    blockers.push(tBlockers("leagueMissing"));
  }

  if (!readiness.calendar.complete) {
    blockers.push(
      tBlockers("calendarIncomplete", {
        set: readiness.calendar.set,
        required: readiness.calendar.required,
      }),
    );
  }

  if (readiness.groups.length === 0) {
    blockers.push(tBlockers("noGroups"));
  }

  for (const group of readiness.groups) {
    if (group.groupReady) continue;
    const label = groupLabel(group);
    if (!groupTeamsComplete(group)) {
      if (
        group.teamCount >= 7 &&
        group.teamCount <= 8 &&
        !group.slotsComplete
      ) {
        blockers.push(tBlockers("slotsIncomplete", { label }));
      } else if (group.teamCount < REGIONAL_MIN_TEAMS) {
        blockers.push(
          tBlockers("teamsMin", {
            label,
            teamLabel: translateGroupTeamLabel(group, tBlockers),
            min: REGIONAL_MIN_TEAMS,
          }),
        );
      } else {
        blockers.push(
          tBlockers("teamsIncomplete", {
            label,
            teamLabel: translateGroupTeamLabel(group, tBlockers),
          }),
        );
      }
    } else if (!group.datesComplete) {
      blockers.push(tBlockers("datesIncomplete", { label }));
    }
  }

  return blockers;
}
