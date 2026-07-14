export type ClubAddressFields = {
  address?: string | null;
  postal_code?: string | null;
  location?: string | null;
};

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Full club address from membership data: address - postal code - location. */
export function formatClubAddress(
  club: ClubAddressFields | null | undefined,
): string | null {
  if (!club) return null;
  const parts = [
    trimmedOrNull(club.address),
    trimmedOrNull(club.postal_code),
    trimmedOrNull(club.location),
  ].filter((part): part is string => part != null);
  return parts.length > 0 ? parts.join(" - ") : null;
}
