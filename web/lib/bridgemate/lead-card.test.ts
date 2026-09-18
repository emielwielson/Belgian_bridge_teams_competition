import { describe, expect, it } from "vitest";
import {
  formatLeadCard,
  parseLeadCard,
} from "@/lib/bridgemate/lead-card";

describe("parseLeadCard", () => {
  it("parses Bridgemate sim leads", () => {
    expect(parseLeadCard("SA")).toEqual({ suit: "S", rank: "A" });
    expect(parseLeadCard("HK")).toEqual({ suit: "H", rank: "K" });
    expect(parseLeadCard("DQ")).toEqual({ suit: "D", rank: "Q" });
    expect(parseLeadCard("CJ")).toEqual({ suit: "C", rank: "J" });
    expect(parseLeadCard("S2")).toEqual({ suit: "S", rank: "2" });
    expect(parseLeadCard("H3")).toEqual({ suit: "H", rank: "3" });
    expect(parseLeadCard("D4")).toEqual({ suit: "D", rank: "4" });
    expect(parseLeadCard("C5")).toEqual({ suit: "C", rank: "5" });
  });

  it("accepts 10 and T for ten", () => {
    expect(parseLeadCard("S10")).toEqual({ suit: "S", rank: "10" });
    expect(parseLeadCard("ST")).toEqual({ suit: "S", rank: "10" });
  });

  it("trims and uppercases", () => {
    expect(parseLeadCard(" sa ")).toEqual({ suit: "S", rank: "A" });
    expect(parseLeadCard("hk")).toEqual({ suit: "H", rank: "K" });
  });

  it("returns null for empty or invalid", () => {
    expect(parseLeadCard(null)).toBeNull();
    expect(parseLeadCard(undefined)).toBeNull();
    expect(parseLeadCard("")).toBeNull();
    expect(parseLeadCard("  ")).toBeNull();
    expect(parseLeadCard("PASS")).toBeNull();
    expect(parseLeadCard("AS")).toBeNull();
    expect(parseLeadCard("NX")).toBeNull();
  });
});

describe("formatLeadCard", () => {
  it("formats with suit symbols", () => {
    expect(formatLeadCard("SA")).toBe("♠A");
    expect(formatLeadCard("HK")).toBe("♥K");
    expect(formatLeadCard("DQ")).toBe("♦Q");
    expect(formatLeadCard("CJ")).toBe("♣J");
    expect(formatLeadCard("S10")).toBe("♠10");
  });

  it("returns null when unparseable", () => {
    expect(formatLeadCard(null)).toBeNull();
    expect(formatLeadCard("xx")).toBeNull();
  });
});
