import { describe, expect, it } from "vitest";
import { regionalDivisionLevelCode } from "./regional-division-level";

describe("regionalDivisionLevelCode", () => {
  it("maps Liga 1/2/3 names", () => {
    expect(regionalDivisionLevelCode("Liga 1")).toBe("first");
    expect(regionalDivisionLevelCode("Liga 2")).toBe("second");
    expect(regionalDivisionLevelCode("Liga 3")).toBe("third");
  });

  it("defaults unknown names to first (never honor)", () => {
    expect(regionalDivisionLevelCode("Superleague")).toBe("first");
  });
});
