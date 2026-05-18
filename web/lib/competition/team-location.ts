/** Match venue for a team comes from its club. */
export function teamLocationFromClub(
  club: { location?: string | null } | null | undefined,
): string | null {
  const value = club?.location?.trim();
  return value ? value : null;
}
