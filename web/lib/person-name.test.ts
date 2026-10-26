import { describe, expect, it } from "vitest";
import {
  formatPairDisplayName,
  formatPersonName,
  withFormattedPersonName,
} from "@/lib/person-name";

describe("formatPersonName", () => {
  it("title-cases fully uppercase surnames", () => {
    expect(formatPersonName("Jan PEETERS")).toBe("Jan Peeters");
  });

  it("leaves mixed-case names unchanged", () => {
    expect(formatPersonName("Jan Peeters")).toBe("Jan Peeters");
  });

  it("title-cases hyphenated uppercase tokens", () => {
    expect(formatPersonName("JEAN-PIERRE")).toBe("Jean-Pierre");
  });
});

describe("formatPairDisplayName", () => {
  it("normalizes both sides of a pair", () => {
    expect(formatPairDisplayName("Jan PEETERS · Marie DUPONT")).toBe(
      "Jan Peeters · Marie Dupont",
    );
  });
});

describe("withFormattedPersonName", () => {
  it("formats name and optional first/last", () => {
    expect(
      withFormattedPersonName({
        name: "Jan PEETERS",
        first_name: "JAN",
        last_name: "PEETERS",
      }),
    ).toEqual({
      name: "Jan Peeters",
      first_name: "Jan",
      last_name: "Peeters",
    });
  });
});
