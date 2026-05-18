import { REGION_CODES, type RegionCode } from "./scopes";

/** Exactly three leagues per season: National, Flanders, Wallonia. */
export const LEAGUE_NAMES = {
  NATIONAL: "National",
  FLANDERS: "Flanders",
  WALLONIA: "Wallonia",
} as const;

export type LeagueName = (typeof LEAGUE_NAMES)[keyof typeof LEAGUE_NAMES];

/** @deprecated Use LEAGUE_NAMES.NATIONAL */
export const NATIONAL_LEAGUE_NAME = LEAGUE_NAMES.NATIONAL;

export function regionalLeagueName(regionCode: RegionCode): LeagueName {
  return regionCode === REGION_CODES.WALLONIA
    ? LEAGUE_NAMES.WALLONIA
    : LEAGUE_NAMES.FLANDERS;
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
