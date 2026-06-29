import { describe, expect, it } from "vitest";
import {
  isScopeSetupLocked,
  requireScopeInSetup,
  SetupLockedError,
} from "./scope-setup";

describe("scope-setup", () => {
  it("isScopeSetupLocked returns false for setup", () => {
    expect(isScopeSetupLocked("setup")).toBe(false);
  });

  it("isScopeSetupLocked returns true for active or finished", () => {
    expect(isScopeSetupLocked("active")).toBe(true);
    expect(isScopeSetupLocked("finished")).toBe(true);
  });

  it("requireScopeInSetup throws for active league", () => {
    expect(() => requireScopeInSetup("active")).toThrow(SetupLockedError);
  });

  it("requireScopeInSetup passes for setup league", () => {
    expect(() => requireScopeInSetup("setup")).not.toThrow();
  });
});
