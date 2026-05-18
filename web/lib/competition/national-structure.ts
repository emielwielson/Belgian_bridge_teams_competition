/** Canonical National competition layout (one group per division, 8 teams each). */

export type NationalScheduleKey = "honor" | "first" | "default";

export type NationalDivisionSpec = {
  /** Division display name (also used as the single group name). */
  name: string;
  divisionLevelCode: "honor" | "first" | "second" | "third";
  maxMatchesPerDay: number | null;
  /** Fixture rounds (Honor = triple round-robin). */
  roundCount: number;
  /** Which match-date calendar applies (Honor and 1st are separate). */
  scheduleKey: NationalScheduleKey;
};

/** Rounds per national match-date calendar. */
export const NATIONAL_SCHEDULE_ROUND_COUNTS: Record<NationalScheduleKey, number> =
  {
    honor: 21,
    first: 14,
    default: 14,
  };

export const NATIONAL_LEAGUE_NAME = "National";

export const NATIONAL_DIVISIONS: NationalDivisionSpec[] = [
  {
    name: "Honor",
    divisionLevelCode: "honor",
    maxMatchesPerDay: 3,
    roundCount: 21,
    scheduleKey: "honor",
  },
  {
    name: "1st Division",
    divisionLevelCode: "first",
    maxMatchesPerDay: 2,
    roundCount: 14,
    scheduleKey: "first",
  },
  {
    name: "2nd Division A",
    divisionLevelCode: "second",
    maxMatchesPerDay: null,
    roundCount: 14,
    scheduleKey: "default",
  },
  {
    name: "2nd Division B",
    divisionLevelCode: "second",
    maxMatchesPerDay: null,
    roundCount: 14,
    scheduleKey: "default",
  },
  {
    name: "3rd Division A",
    divisionLevelCode: "third",
    maxMatchesPerDay: null,
    roundCount: 14,
    scheduleKey: "default",
  },
  {
    name: "3rd Division B",
    divisionLevelCode: "third",
    maxMatchesPerDay: null,
    roundCount: 14,
    scheduleKey: "default",
  },
  {
    name: "3rd Division C",
    divisionLevelCode: "third",
    maxMatchesPerDay: null,
    roundCount: 14,
    scheduleKey: "default",
  },
  {
    name: "3rd Division D",
    divisionLevelCode: "third",
    maxMatchesPerDay: null,
    roundCount: 14,
    scheduleKey: "default",
  },
];

export const NATIONAL_SCHEDULE_LABELS: Record<NationalScheduleKey, string> = {
  honor: "Honor (21 rounds, 7 match days × 3 slots, max 3 matches per day per team)",
  first: "1st Division (separate schedule, max 2 matches per day per team)",
  default: "2nd & 3rd divisions (shared schedule)",
};
