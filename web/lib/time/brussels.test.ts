import { afterEach, describe, expect, it, vi } from "vitest";
import {
  brusselsTodayDateString,
  formatBrusselsRoundHeader,
  isBrusselsDateBeforeToday,
  toBrusselsDateString,
} from "./brussels";

describe("formatBrusselsRoundHeader", () => {
  it("formats date as DD/MM/YY in Brussels timezone", () => {
    const { date, time } = formatBrusselsRoundHeader(
      "2024-10-04T12:00:00.000Z",
    );
    expect(date).toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
    expect(time).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("toBrusselsDateString", () => {
  it("returns YYYY-MM-DD in Europe/Brussels", () => {
    // 2024-10-04 00:30 UTC is still 2024-10-04 in Brussels (CEST +02)
    expect(toBrusselsDateString("2024-10-04T00:30:00.000Z")).toBe("2024-10-04");
    // 2024-10-03 23:30 UTC is 2024-10-04 01:30 in Brussels
    expect(toBrusselsDateString("2024-10-03T23:30:00.000Z")).toBe("2024-10-04");
  });
});

describe("isBrusselsDateBeforeToday", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects yesterday and allows today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T12:00:00.000Z"));
    expect(brusselsTodayDateString()).toBe("2026-10-14");
    expect(isBrusselsDateBeforeToday("2026-10-13T12:00:00.000Z")).toBe(true);
    expect(isBrusselsDateBeforeToday("2026-10-14T08:00:00.000Z")).toBe(false);
    expect(isBrusselsDateBeforeToday("2026-10-15T12:00:00.000Z")).toBe(false);
  });
});
