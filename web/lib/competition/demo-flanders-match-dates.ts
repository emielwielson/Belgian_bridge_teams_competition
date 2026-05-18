/**
 * Flanders regional demo match days (2024–25 season), all at 14:00 Brussels.
 */

export type FlandersDemoRoundSlot = {
  round: number;
  date: string;
  time: string;
};

const FLANDERS_14_MATCH_DAYS = [
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
] as const;

const FLANDERS_12_MATCH_DAYS = FLANDERS_14_MATCH_DAYS.slice(0, 12);

function toSlots(days: readonly string[]): FlandersDemoRoundSlot[] {
  return days.map((date, index) => ({
    round: index + 1,
    date,
    time: "14:00",
  }));
}

export const FLANDERS_14_ROUNDS = toSlots(FLANDERS_14_MATCH_DAYS);
export const FLANDERS_12_ROUNDS = toSlots(FLANDERS_12_MATCH_DAYS);

export function flandersSlotToBrusselsLocal({
  date,
  time,
}: FlandersDemoRoundSlot): string {
  return `${date}T${time}`;
}
