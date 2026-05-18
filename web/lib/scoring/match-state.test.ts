import { describe, expect, it } from "vitest";
import { matchStatus } from "./match-state";

describe("matchStatus", () => {
  it("returns scheduled when played_at is null", () => {
    expect(matchStatus(null)).toBe("scheduled");
  });

  it("returns played when played_at is set", () => {
    expect(matchStatus("2025-01-01T12:00:00Z")).toBe("played");
  });
});
