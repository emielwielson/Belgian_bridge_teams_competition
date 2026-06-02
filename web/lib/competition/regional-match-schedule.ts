import { REGIONAL_CALENDAR_ROUNDS } from "./group-match-rounds";

/** Fixed Brussels start time for regional matches (never edited in admin UI). */
export const REGIONAL_SLOT_TIME = "14:00";

export const REGIONAL_MATCH_DAY_COUNT = REGIONAL_CALENDAR_ROUNDS;

export function expandRegionalMatchDaysToRounds(
  matchDays: string[],
): { round: number; datetime: string }[] {
  if (matchDays.length !== REGIONAL_MATCH_DAY_COUNT) {
    throw new Error(
      `Expected ${REGIONAL_MATCH_DAY_COUNT} match days, got ${matchDays.length}`,
    );
  }

  return matchDays.map((date, index) => {
    if (!date) {
      throw new Error(`Round ${index + 1} is missing a date`);
    }
    return { round: index + 1, datetime: `${date}T${REGIONAL_SLOT_TIME}` };
  });
}

/** Extract YYYY-MM-DD (Brussels) from stored round datetimes — one date per round. */
export function collapseRoundsToRegionalMatchDays(
  rounds: { round: number; datetime: string }[],
): string[] {
  const byRound = new Map(rounds.map((r) => [r.round, r.datetime]));
  return Array.from({ length: REGIONAL_MATCH_DAY_COUNT }, (_, i) => {
    const iso = byRound.get(i + 1);
    return iso ? toBrusselsDateInput(iso) : "";
  });
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
