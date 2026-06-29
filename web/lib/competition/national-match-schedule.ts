import type { NationalScheduleKey } from "./national-structure";

/** Fixed Brussels start times per national schedule (never edited in admin UI). */
export const NATIONAL_SLOT_TIMES: Record<NationalScheduleKey, readonly string[]> = {
  honor: ["11:00", "13:50", "16:40"],
  first: ["13:00", "16:00"],
  default: ["14:00"],
};

/** Number of match days the competition manager picks per calendar. */
export const NATIONAL_MATCH_DAY_COUNTS: Record<NationalScheduleKey, number> = {
  honor: 7,
  first: 7,
  default: 14,
};

export function slotsPerMatchDay(scheduleKey: NationalScheduleKey): number {
  return NATIONAL_SLOT_TIMES[scheduleKey].length;
}

export function formatSlotTimesLabel(scheduleKey: NationalScheduleKey): string {
  return NATIONAL_SLOT_TIMES[scheduleKey].join(", ");
}

/** 1st Division stacks mirror legs on one day; Honor/Default use consecutive rounds per day. */
export function usesStackedLegsPerDay(scheduleKey: NationalScheduleKey): boolean {
  return scheduleKey === "first";
}

/** Fixture round number for a match-day slot (0-based day and slot indices). */
export function roundForMatchDaySlot(
  scheduleKey: NationalScheduleKey,
  dayIndex: number,
  slotIndex: number,
): number {
  const slots = slotsPerMatchDay(scheduleKey);
  const dayCount = NATIONAL_MATCH_DAY_COUNTS[scheduleKey];
  if (usesStackedLegsPerDay(scheduleKey)) {
    return dayIndex + 1 + slotIndex * dayCount;
  }
  return dayIndex * slots + slotIndex + 1;
}

/** First fixture round on a match day — used when collapsing stored dates to match days. */
export function anchorRoundForMatchDay(
  scheduleKey: NationalScheduleKey,
  dayIndex: number,
): number {
  return roundForMatchDaySlot(scheduleKey, dayIndex, 0);
}

export function expandMatchDaysToRounds(
  scheduleKey: NationalScheduleKey,
  matchDays: string[],
): { round: number; datetime: string }[] {
  const dayCount = NATIONAL_MATCH_DAY_COUNTS[scheduleKey];
  if (matchDays.length !== dayCount) {
    throw new Error(
      `Expected ${dayCount} match days for ${scheduleKey}, got ${matchDays.length}`,
    );
  }

  const times = NATIONAL_SLOT_TIMES[scheduleKey];
  const rows: { round: number; datetime: string }[] = [];

  for (let dayIndex = 0; dayIndex < matchDays.length; dayIndex++) {
    const date = matchDays[dayIndex];
    if (!date) {
      throw new Error(`Match day ${dayIndex + 1} is missing a date`);
    }
    for (let slotIndex = 0; slotIndex < times.length; slotIndex++) {
      const round = roundForMatchDaySlot(scheduleKey, dayIndex, slotIndex);
      rows.push({ round, datetime: `${date}T${times[slotIndex]}` });
    }
  }

  return rows.sort((a, b) => a.round - b.round);
}

/** Extract YYYY-MM-DD (Brussels) from stored round datetimes — one date per match day. */
export function collapseRoundsToMatchDays(
  scheduleKey: NationalScheduleKey,
  rounds: { round: number; datetime: string }[],
): string[] {
  const dayCount = NATIONAL_MATCH_DAY_COUNTS[scheduleKey];
  const byRound = new Map(rounds.map((r) => [r.round, r.datetime]));
  const days: string[] = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const iso = byRound.get(anchorRoundForMatchDay(scheduleKey, dayIndex));
    days.push(iso ? toBrusselsDateInput(iso) : "");
  }

  return days;
}

function toBrusselsDateInput(isoUtc: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(isoUtc));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
