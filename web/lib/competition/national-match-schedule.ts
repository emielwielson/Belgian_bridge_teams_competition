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

export function expandMatchDaysToRounds(
  scheduleKey: NationalScheduleKey,
  matchDays: string[],
): { round: number; datetime: string }[] {
  const expectedDays = NATIONAL_MATCH_DAY_COUNTS[scheduleKey];
  if (matchDays.length !== expectedDays) {
    throw new Error(
      `Expected ${expectedDays} match days for ${scheduleKey}, got ${matchDays.length}`,
    );
  }

  const times = NATIONAL_SLOT_TIMES[scheduleKey];
  const rows: { round: number; datetime: string }[] = [];
  let round = 1;

  for (const date of matchDays) {
    if (!date) {
      throw new Error(`Match day ${round} is missing a date`);
    }
    for (const time of times) {
      rows.push({ round, datetime: `${date}T${time}` });
      round += 1;
    }
  }

  return rows;
}

/** Extract YYYY-MM-DD (Brussels) from stored round datetimes — one date per match day. */
export function collapseRoundsToMatchDays(
  scheduleKey: NationalScheduleKey,
  rounds: { round: number; datetime: string }[],
): string[] {
  const dayCount = NATIONAL_MATCH_DAY_COUNTS[scheduleKey];
  const perDay = slotsPerMatchDay(scheduleKey);
  const byRound = new Map(rounds.map((r) => [r.round, r.datetime]));
  const days: string[] = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const firstRound = dayIndex * perDay + 1;
    const iso = byRound.get(firstRound);
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
