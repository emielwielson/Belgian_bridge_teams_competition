import { describe, expect, it } from "vitest";
import {
  rosterExclusivityPool,
  sameRosterExclusivityPool,
} from "./roster-exclusivity";

describe("rosterExclusivityPool", () => {
  it("maps linked competition kinds", () => {
    expect(rosterExclusivityPool("national")).toBe("linked");
    expect(rosterExclusivityPool("flanders")).toBe("linked");
    expect(rosterExclusivityPool("wallonia")).toBe("linked");
  });

  it("maps zweiffel separately", () => {
    expect(rosterExclusivityPool("zweiffel")).toBe("zweiffel");
  });

  it("returns null for unknown or empty", () => {
    expect(rosterExclusivityPool(null)).toBeNull();
    expect(rosterExclusivityPool(undefined)).toBeNull();
    expect(rosterExclusivityPool("")).toBeNull();
    expect(rosterExclusivityPool("other")).toBeNull();
  });
});

describe("sameRosterExclusivityPool", () => {
  it("is true within linked pool", () => {
    expect(sameRosterExclusivityPool("national", "flanders")).toBe(true);
    expect(sameRosterExclusivityPool("wallonia", "national")).toBe(true);
  });

  it("is true within zweiffel", () => {
    expect(sameRosterExclusivityPool("zweiffel", "zweiffel")).toBe(true);
  });

  it("is false across linked and zweiffel", () => {
    expect(sameRosterExclusivityPool("national", "zweiffel")).toBe(false);
    expect(sameRosterExclusivityPool("zweiffel", "flanders")).toBe(false);
  });
});
