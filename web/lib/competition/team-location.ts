import { formatClubAddress, type ClubAddressFields } from "./club-address";

type ClubLocationFields = ClubAddressFields & {
  competition_location?: string | null;
};

type DivisionLocationFields = {
  centralized_location?: string | null;
};

type TeamLocationFields = {
  location?: string | null;
};

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Club competition venue without division/team overrides. */
export function resolveClubMatchLocation(
  club: ClubLocationFields | null | undefined,
): string | null {
  const override = trimmedOrNull(club?.competition_location);
  if (override) return override;
  return formatClubAddress(club);
}

/**
 * Match venue: division centralized venue, then team override, then club
 * competition override, then membership default.
 */
export function resolveTeamMatchLocation(
  club: ClubLocationFields | null | undefined,
  division?: DivisionLocationFields | null | undefined,
  team?: TeamLocationFields | null | undefined,
): string | null {
  const centralized = trimmedOrNull(division?.centralized_location);
  if (centralized) return centralized;

  const teamOverride = trimmedOrNull(team?.location);
  if (teamOverride) return teamOverride;

  return resolveClubMatchLocation(club);
}

/** @deprecated Use resolveTeamMatchLocation */
export function teamLocationFromClub(
  club: ClubLocationFields | null | undefined,
): string | null {
  return resolveTeamMatchLocation(club);
}
