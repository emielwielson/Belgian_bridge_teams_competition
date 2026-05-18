import { LEAGUE_NAMES, regionalLeagueName } from "./league-names";

export const SCOPES = {
  NATIONAL: "national",
  REGIONAL: "regional",
} as const;

export type CompetitionScope = (typeof SCOPES)[keyof typeof SCOPES];

export const REGION_CODES = {
  FLANDERS: "flanders",
  WALLONIA: "wallonia",
} as const;

export type RegionCode = (typeof REGION_CODES)[keyof typeof REGION_CODES];

export function parseScopeParam(scope: string): CompetitionScope | null {
  if (scope === SCOPES.NATIONAL || scope === SCOPES.REGIONAL) return scope;
  return null;
}

export function parseRegionParam(region: string): RegionCode | null {
  if (region === REGION_CODES.FLANDERS || region === REGION_CODES.WALLONIA) {
    return region;
  }
  return null;
}

export function scopeLabel(scope: CompetitionScope, regionCode?: string): string {
  if (scope === SCOPES.NATIONAL) return LEAGUE_NAMES.NATIONAL;
  if (regionCode === REGION_CODES.WALLONIA || regionCode === REGION_CODES.FLANDERS) {
    return regionalLeagueName(regionCode);
  }
  return LEAGUE_NAMES.FLANDERS;
}

export function adminScopePath(scope: CompetitionScope, regionCode?: string): string {
  if (scope === SCOPES.NATIONAL) return "/admin/competition/national";
  return `/admin/competition/regional/${regionCode ?? REGION_CODES.FLANDERS}`;
}
