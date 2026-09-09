import { describe, expect, it } from "vitest";
import {
  COMPETITION_KIND_CODES,
  kindCodeForScopeRegion,
  kindCodeForUnit,
  managesKindCode,
} from "@/lib/auth/competition-scope";
import { REGION_CODES, SCOPES } from "@/lib/competition/scopes";

describe("competition-scope helpers", () => {
  it("maps units to kind codes", () => {
    expect(kindCodeForUnit({ scope: SCOPES.NATIONAL })).toBe(
      COMPETITION_KIND_CODES.NATIONAL,
    );
    expect(
      kindCodeForUnit({
        scope: SCOPES.REGIONAL,
        regionCode: REGION_CODES.WALLONIA,
      }),
    ).toBe(COMPETITION_KIND_CODES.WALLONIA);
    expect(
      kindCodeForUnit({
        scope: SCOPES.REGIONAL,
        regionCode: REGION_CODES.FLANDERS,
      }),
    ).toBe(COMPETITION_KIND_CODES.FLANDERS);
  });

  it("maps scope/region params", () => {
    expect(kindCodeForScopeRegion(SCOPES.NATIONAL)).toBe(
      COMPETITION_KIND_CODES.NATIONAL,
    );
    expect(kindCodeForScopeRegion(SCOPES.REGIONAL, "wallonia")).toBe(
      COMPETITION_KIND_CODES.WALLONIA,
    );
    expect(kindCodeForScopeRegion(SCOPES.REGIONAL, "unknown")).toBeNull();
  });

  it("treats global managed kinds as all", () => {
    const managed = {
      isGlobal: true as const,
      kindIds: ["1", "2"],
      kindCodes: [
        COMPETITION_KIND_CODES.NATIONAL,
        COMPETITION_KIND_CODES.FLANDERS,
        COMPETITION_KIND_CODES.WALLONIA,
      ],
    };
    expect(managesKindCode(managed, COMPETITION_KIND_CODES.WALLONIA)).toBe(
      true,
    );
  });

  it("restricts scoped managers", () => {
    const managed = {
      isGlobal: false as const,
      kindIds: ["w"],
      kindCodes: [COMPETITION_KIND_CODES.WALLONIA],
    };
    expect(managesKindCode(managed, COMPETITION_KIND_CODES.WALLONIA)).toBe(
      true,
    );
    expect(managesKindCode(managed, COMPETITION_KIND_CODES.NATIONAL)).toBe(
      false,
    );
  });
});
