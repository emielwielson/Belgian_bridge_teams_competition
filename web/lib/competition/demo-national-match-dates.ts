/**
 * National match dates from 2024–25 (Europe/Brussels).
 * Honor: 21 rounds on 7 days (11:00 / 13:50 / 16:40 each day).
 * 1st Division: 14 rounds on 7 days (13:00 / 16:00 each day).
 * 2nd/3rd: 14 rounds, one Saturday per round at 14:00.
 */

export type DemoRoundSlot = {
  round: number;
  /** YYYY-MM-DD in Brussels */
  date: string;
  /** HH:mm in Brussels */
  time: string;
};

const HONOR_MATCH_DAYS = [
  "2024-09-27",
  "2024-10-04",
  "2024-10-11",
  "2024-10-18",
  "2024-11-08",
  "2024-11-22",
  "2024-11-29",
] as const;

const HONOR_SLOT_TIMES = ["11:00", "13:50", "16:40"] as const;

/** 7 match days × 3 slots = 21 rounds (triple round-robin). */
export const DEMO_HONOR_ROUNDS: DemoRoundSlot[] = HONOR_MATCH_DAYS.flatMap(
  (date) =>
    HONOR_SLOT_TIMES.map((time, slotIndex) => ({
      round:
        HONOR_MATCH_DAYS.indexOf(date) * HONOR_SLOT_TIMES.length + slotIndex + 1,
      date,
      time,
    })),
);

const FIRST_MATCH_DAYS = HONOR_MATCH_DAYS;

const FIRST_SLOT_TIMES = ["13:00", "16:00"] as const;

/** 7 match days × 2 slots = 14 rounds. */
export const DEMO_FIRST_ROUNDS: DemoRoundSlot[] = FIRST_MATCH_DAYS.flatMap(
  (date) =>
    FIRST_SLOT_TIMES.map((time, slotIndex) => ({
      round:
        FIRST_MATCH_DAYS.indexOf(date) * FIRST_SLOT_TIMES.length + slotIndex + 1,
      date,
      time,
    })),
);

export const DEMO_DEFAULT_ROUNDS: DemoRoundSlot[] = [
  { round: 1, date: "2024-09-27", time: "14:00" },
  { round: 2, date: "2024-10-04", time: "14:00" },
  { round: 3, date: "2024-10-11", time: "14:00" },
  { round: 4, date: "2024-10-18", time: "14:00" },
  { round: 5, date: "2024-11-08", time: "14:00" },
  { round: 6, date: "2024-11-15", time: "14:00" },
  { round: 7, date: "2024-11-22", time: "14:00" },
  { round: 8, date: "2024-12-06", time: "14:00" },
  { round: 9, date: "2024-12-13", time: "14:00" },
  { round: 10, date: "2025-01-17", time: "14:00" },
  { round: 11, date: "2025-01-24", time: "14:00" },
  { round: 12, date: "2025-01-31", time: "14:00" },
  { round: 13, date: "2025-02-14", time: "14:00" },
  { round: 14, date: "2025-02-28", time: "14:00" },
];

export function demoSlotToBrusselsLocal({ date, time }: DemoRoundSlot): string {
  return `${date}T${time}`;
}
