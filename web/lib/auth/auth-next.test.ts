import { describe, expect, it } from "vitest";
import { safeNextPath } from "./auth-next";

describe("safeNextPath", () => {
  it("allows relative paths", () => {
    expect(safeNextPath("/player")).toBe("/player");
    expect(safeNextPath("/auth/select-player")).toBe("/auth/select-player");
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});
