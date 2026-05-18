/**
 * Demo match days from 2024–25 (Europe/Brussels).
 * Times are fixed per schedule — see national-match-schedule.ts.
 */

import {
  expandMatchDaysToRounds,
  type NationalScheduleKey,
} from "./national-match-schedule";

export type DemoRoundSlot = {
  round: number;
  date: string;
  time: string;
};

const DEMO_HONOR_DAYS = [
  "2024-09-27",
  "2024-10-04",
  "2024-10-11",
  "2024-10-18",
  "2024-11-08",
  "2024-11-22",
  "2024-11-29",
];

const DEMO_FIRST_DAYS = DEMO_HONOR_DAYS;

const DEMO_DEFAULT_DAYS = [
  "2024-09-27",
  "2024-10-04",
  "2024-10-11",
  "2024-10-18",
  "2024-11-08",
  "2024-11-15",
  "2024-11-22",
  "2024-12-06",
  "2024-12-13",
  "2025-01-17",
  "2025-01-24",
  "2025-01-31",
  "2025-02-14",
  "2025-02-28",
];

function toDemoSlots(
  scheduleKey: NationalScheduleKey,
  days: readonly string[],
): DemoRoundSlot[] {
  return expandMatchDaysToRounds(scheduleKey, [...days]).map((r) => {
    const [date, time] = r.datetime.split("T");
    return { round: r.round, date, time };
  });
}

export const DEMO_HONOR_ROUNDS = toDemoSlots("honor", DEMO_HONOR_DAYS);
export const DEMO_FIRST_ROUNDS = toDemoSlots("first", DEMO_FIRST_DAYS);
export const DEMO_DEFAULT_ROUNDS = toDemoSlots("default", DEMO_DEFAULT_DAYS);

export function demoSlotToBrusselsLocal({
  date,
  time,
}: DemoRoundSlot): string {
  return `${date}T${time}`;
}
