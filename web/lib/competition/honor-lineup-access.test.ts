import { describe, expect, it } from "vitest";
import {
  canUnlockHonorLineup,
  honorPermissionsForViewer,
} from "./honor-lineup-access";

describe("canUnlockHonorLineup", () => {
  it("allows arbiter access roles", () => {
    expect(
      canUnlockHonorLineup({ roles: ["arbiter"], viewerSide: "other" }),
    ).toBe(true);
    expect(
      canUnlockHonorLineup({
        roles: ["competition_manager"],
        viewerSide: "other",
      }),
    ).toBe(true);
  });

  it("allows scoped manager without arbiter role", () => {
    expect(
      canUnlockHonorLineup({ roles: [], viewerSide: "manager" }),
    ).toBe(true);
  });

  it("denies players", () => {
    expect(
      canUnlockHonorLineup({ roles: ["player"], viewerSide: "home" }),
    ).toBe(false);
  });
});

describe("honorPermissionsForViewer canUnlock", () => {
  it("exposes canUnlock from roles", () => {
    const perms = honorPermissionsForViewer({
      viewerSide: "other",
      phase: "sequential",
      homeLocked: true,
      awayLocked: true,
      played: false,
      roles: ["arbiter"],
    });
    expect(perms.canUnlock).toBe(true);
  });
});
