import { describe, expect, it } from "vitest";
import {
  canUnlockHonorLineup,
  honorPermissionsForViewer,
} from "./honor-lineup-access";

describe("canUnlockHonorLineup", () => {
  it("allows arbiter with honor access", () => {
    expect(
      canUnlockHonorLineup({
        roles: ["arbiter"],
        viewerSide: "other",
        hasHonorAccess: true,
      }),
    ).toBe(true);
  });

  it("denies arbiter without honor access", () => {
    expect(
      canUnlockHonorLineup({
        roles: ["arbiter"],
        viewerSide: "other",
        hasHonorAccess: false,
      }),
    ).toBe(false);
  });

  it("allows competition managers", () => {
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
  it("exposes canUnlock from honor access", () => {
    const perms = honorPermissionsForViewer({
      viewerSide: "other",
      phase: "sequential",
      homeLocked: true,
      awayLocked: true,
      played: false,
      roles: ["arbiter"],
      hasHonorAccess: true,
    });
    expect(perms.canUnlock).toBe(true);
  });
});
