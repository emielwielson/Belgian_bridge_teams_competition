import { describe, expect, it } from "vitest";
import {
  canonicalLeagueName,
  LEAGUE_NAMES,
  regionalLeagueName,
} from "./league-names";
import { REGION_CODES } from "./scopes";

describe("league-names", () => {
  it("defines exactly three canonical league names", () => {
    expect(LEAGUE_NAMES.NATIONAL).toBe("National");
    expect(LEAGUE_NAMES.FLANDERS).toBe("Flanders");
    expect(LEAGUE_NAMES.WALLONIA).toBe("Wallonia");
  });

  it("maps regional scope to region league name", () => {
    expect(regionalLeagueName(REGION_CODES.FLANDERS)).toBe("Flanders");
    expect(regionalLeagueName(REGION_CODES.WALLONIA)).toBe("Wallonia");
    expect(canonicalLeagueName("national")).toBe("National");
    expect(canonicalLeagueName("regional", REGION_CODES.FLANDERS)).toBe(
      "Flanders",
    );
  });
});
