import { describe, expect, it } from "vitest";
import { formatRanks } from "@/components/boards/HandDiagram";

describe("formatRanks", () => {
  it("returns em dash for empty holding", () => {
    expect(formatRanks("")).toBe("—");
  });

  it("keeps T as a single 10 token", () => {
    expect(formatRanks("AKT")).toBe("A\u2009K\u200910");
  });

  it("formats long suits without splitting tens", () => {
    expect(formatRanks("AQJT987")).toBe("A\u2009Q\u2009J\u200910\u20099\u20098\u20097");
  });
});
