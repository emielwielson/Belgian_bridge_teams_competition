type ClubLocationFields = {
  location?: string | null;
  competition_location?: string | null;
};

type DivisionLocationFields = {
  centralized_location?: string | null;
};

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Match venue: division centralized venue, then club override, then membership default. */
export function resolveTeamMatchLocation(
  club: ClubLocationFields | null | undefined,
  division?: DivisionLocationFields | null | undefined,
): string | null {
  const centralized = trimmedOrNull(division?.centralized_location);
  if (centralized) return centralized;

  const override = trimmedOrNull(club?.competition_location);
  if (override) return override;

  return trimmedOrNull(club?.location);
}

/** @deprecated Use resolveTeamMatchLocation */
export function teamLocationFromClub(
  club: ClubLocationFields | null | undefined,
): string | null {
  return resolveTeamMatchLocation(club);
}
