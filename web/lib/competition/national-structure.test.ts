import { describe, expect, it } from "vitest";
import {
  NATIONAL_DIVISIONS,
  NATIONAL_LEAGUE_NAME,
  NATIONAL_SCHEDULE_LABELS,
} from "./national-structure";
import { scheduleKeyForDivisionName } from "./ensure-national-structure";

describe("national structure", () => {
  it("defines eight national divisions", () => {
    expect(NATIONAL_DIVISIONS).toHaveLength(8);
    expect(NATIONAL_LEAGUE_NAME).toBe("National");
  });

  it("assigns separate schedules to Honor and 1st Division", () => {
    const honor = NATIONAL_DIVISIONS.find((d) => d.name === "Honor");
    const first = NATIONAL_DIVISIONS.find((d) => d.name === "1st Division");
    expect(honor?.scheduleKey).toBe("honor");
    expect(honor?.maxMatchesPerDay).toBe(3);
    expect(honor?.roundCount).toBe(21);
    expect(first?.scheduleKey).toBe("first");
    expect(first?.maxMatchesPerDay).toBe(2);
    expect(first?.roundCount).toBe(14);
  });

  it("shares default schedule for 2nd and 3rd divisions", () => {
    const shared = NATIONAL_DIVISIONS.filter((d) => d.scheduleKey === "default");
    expect(shared).toHaveLength(6);
    expect(NATIONAL_SCHEDULE_LABELS.default).toContain("14 match days");
  });

  it("maps division names to schedule keys", () => {
    expect(scheduleKeyForDivisionName("Honor")).toBe("honor");
    expect(scheduleKeyForDivisionName("1st Division")).toBe("first");
    expect(scheduleKeyForDivisionName("2nd Division A")).toBe("default");
  });
});
