import { describe, expect, it } from "vitest";
import { formatBrusselsRoundHeader } from "./brussels";

describe("formatBrusselsRoundHeader", () => {
  it("formats date as DD/MM/YY in Brussels timezone", () => {
    const { date, time } = formatBrusselsRoundHeader(
      "2024-10-04T12:00:00.000Z",
    );
    expect(date).toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
    expect(time).toMatch(/^\d{2}:\d{2}$/);
  });
});
