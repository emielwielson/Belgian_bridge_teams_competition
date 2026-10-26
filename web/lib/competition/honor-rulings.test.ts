import { describe, expect, it } from "vitest";
import { canChooseRulingArbiter } from "./honor-rulings";
import { ROLES } from "@/lib/auth/roles";

describe("canChooseRulingArbiter", () => {
  it("allows competition managers and system admins", () => {
    expect(canChooseRulingArbiter([ROLES.COMPETITION_MANAGER])).toBe(true);
    expect(canChooseRulingArbiter([ROLES.SYSTEM_ADMIN])).toBe(true);
    expect(
      canChooseRulingArbiter([ROLES.ARBITER, ROLES.COMPETITION_MANAGER]),
    ).toBe(true);
  });

  it("denies pure arbiters and players", () => {
    expect(canChooseRulingArbiter([ROLES.ARBITER])).toBe(false);
    expect(canChooseRulingArbiter([ROLES.PLAYER])).toBe(false);
    expect(canChooseRulingArbiter([])).toBe(false);
  });
});
