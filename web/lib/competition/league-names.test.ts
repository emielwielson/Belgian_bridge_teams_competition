import { describe, expect, it } from "vitest";
import {
  canonicalLeagueName,
  leagueNameForCompetitionKind,
  LEAGUE_NAMES,
  regionalLeagueName,
} from "./league-names";
import { REGION_CODES } from "./scopes";

describe("league-names", () => {
  it("defines four canonical league names", () => {
    expect(LEAGUE_NAMES.NATIONAL).toBe("National");
    expect(LEAGUE_NAMES.FLANDERS).toBe("Flanders");
    expect(LEAGUE_NAMES.WALLONIA).toBe("Wallonia");
    expect(LEAGUE_NAMES.ZWEIFFEL).toBe("Zweiffel");
  });

  it("maps regional scope to region league name", () => {
    expect(regionalLeagueName(REGION_CODES.FLANDERS)).toBe("Flanders");
    expect(regionalLeagueName(REGION_CODES.WALLONIA)).toBe("Wallonia");
    expect(regionalLeagueName(REGION_CODES.ZWEIFFEL)).toBe("Zweiffel");
    expect(canonicalLeagueName("national")).toBe("National");
    expect(canonicalLeagueName("regional", REGION_CODES.FLANDERS)).toBe(
      "Flanders",
    );
    expect(canonicalLeagueName("regional", REGION_CODES.ZWEIFFEL)).toBe(
      "Zweiffel",
    );
  });

  it("maps competition kind codes to league names", () => {
    expect(leagueNameForCompetitionKind("national")).toBe("National");
    expect(leagueNameForCompetitionKind("flanders")).toBe("Flanders");
    expect(leagueNameForCompetitionKind("wallonia")).toBe("Wallonia");
    expect(leagueNameForCompetitionKind("zweiffel")).toBe("Zweiffel");
    expect(leagueNameForCompetitionKind(null)).toBeNull();
  });
});
