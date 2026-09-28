import { REGION_CODES, type RegionCode } from "./scopes";

/** Four leagues per season: National, Flanders, Wallonia, Zweiffel. */
export const LEAGUE_NAMES = {
  NATIONAL: "National",
  FLANDERS: "Flanders",
  WALLONIA: "Wallonia",
  ZWEIFFEL: "Zweiffel",
} as const;

export type LeagueName = (typeof LEAGUE_NAMES)[keyof typeof LEAGUE_NAMES];

/** @deprecated Use LEAGUE_NAMES.NATIONAL */
export const NATIONAL_LEAGUE_NAME = LEAGUE_NAMES.NATIONAL;

export function regionalLeagueName(regionCode: RegionCode): LeagueName {
  if (regionCode === REGION_CODES.WALLONIA) return LEAGUE_NAMES.WALLONIA;
  if (regionCode === REGION_CODES.ZWEIFFEL) return LEAGUE_NAMES.ZWEIFFEL;
  return LEAGUE_NAMES.FLANDERS;
}

export function canonicalLeagueName(
  scope: "national" | "regional",
  regionCode?: RegionCode,
): LeagueName {
  if (scope === "national") return LEAGUE_NAMES.NATIONAL;
  if (!regionCode) {
    throw new Error("regionCode required for regional league");
  }
  return regionalLeagueName(regionCode);
}

/** Display name for a competition_kinds.code (player “my teams” labels). */
export function leagueNameForCompetitionKind(
  kindCode: string | null | undefined,
): LeagueName | null {
  if (kindCode === "national") return LEAGUE_NAMES.NATIONAL;
  if (kindCode === "flanders") return LEAGUE_NAMES.FLANDERS;
  if (kindCode === "wallonia") return LEAGUE_NAMES.WALLONIA;
  if (kindCode === "zweiffel") return LEAGUE_NAMES.ZWEIFFEL;
  return null;
}
