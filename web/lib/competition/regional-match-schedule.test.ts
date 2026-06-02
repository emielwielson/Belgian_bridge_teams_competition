import { describe, expect, it } from "vitest";
import {
  collapseRoundsToRegionalMatchDays,
  expandRegionalMatchDaysToRounds,
  REGIONAL_MATCH_DAY_COUNT,
  REGIONAL_SLOT_TIME,
} from "./regional-match-schedule";

describe("regional match schedule", () => {
  it("expands 14 dates to rounds at 14:00", () => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = String(i + 1).padStart(2, "0");
      return `2024-10-${d}`;
    });
    const rounds = expandRegionalMatchDaysToRounds(days);
    expect(rounds).toHaveLength(14);
    expect(rounds[0]).toEqual({ round: 1, datetime: "2024-10-01T14:00" });
    expect(rounds[13]).toEqual({ round: 14, datetime: "2024-10-14T14:00" });
  });

  it("round-trips match days", () => {
    const days = [
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
    const rounds = expandRegionalMatchDaysToRounds(days);
    const collapsed = collapseRoundsToRegionalMatchDays(rounds);
    expect(collapsed).toEqual(days);
  });

  it("uses fixed 14:00 slot time", () => {
    expect(REGIONAL_SLOT_TIME).toBe("14:00");
    expect(REGIONAL_MATCH_DAY_COUNT).toBe(14);
  });
});
