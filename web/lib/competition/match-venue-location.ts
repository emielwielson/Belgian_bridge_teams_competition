import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { resolveTeamMatchLocation } from "./team-location";

/** Team whose venue hosts the match (after home/away switch when set). */
export function venueTeamIdForMatch(match: {
  home_team_id: string;
  hosting_team_id?: string | null;
}): string {
  return match.hosting_team_id ?? match.home_team_id;
}

function isMissingHostingTeamIdColumn(error: PostgrestError | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" &&
    typeof error.message === "string" &&
    error.message.includes("hosting_team_id")
  );
}

function unwrapOne<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}

type VenueTeamRow = {
  location?: string | null;
  club?: unknown;
  group?: unknown;
};

const TEAM_VENUE_FIELDS = `
  location,
  club:clubs(address, postal_code, location, competition_location),
  group:groups (
    division:divisions (
      centralized_location
    )
  )
`;

/** Resolve competition venue text from a nested team row. */
export function locationFromVenueTeamRow(
  teamRow: VenueTeamRow | null | undefined,
): string | null {
  if (!teamRow) return null;

  const club = unwrapOne<{
    address: string | null;
    postal_code: string | null;
    location: string | null;
    competition_location: string | null;
  }>(teamRow.club);

  const group = unwrapOne<{ division: unknown }>(teamRow.group);
  const division = group
    ? unwrapOne<{ centralized_location: string | null }>(group.division)
    : null;

  const locationOverride =
    typeof teamRow.location === "string" && teamRow.location.trim()
      ? teamRow.location.trim()
      : null;

  return resolveTeamMatchLocation(club, division, {
    location: locationOverride,
  });
}

/**
 * Competition venue for a match: hosting team's resolved location.
 * Single query (home + away nested); callers should skip Honor Division.
 */
export async function loadMatchVenueLocation(
  supabase: SupabaseClient,
  match: { id: string; home_team_id: string; away_team_id?: string },
): Promise<string | null> {
  const { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .select(
      `
      home_team_id,
      hosting_team_id,
      home_team:teams!matches_home_team_id_fkey (${TEAM_VENUE_FIELDS}),
      away_team:teams!matches_away_team_id_fkey (${TEAM_VENUE_FIELDS})
    `,
    )
    .eq("id", match.id)
    .maybeSingle();

  if (isMissingHostingTeamIdColumn(matchError)) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("matches")
      .select(
        `
        home_team_id,
        home_team:teams!matches_home_team_id_fkey (${TEAM_VENUE_FIELDS})
      `,
      )
      .eq("id", match.id)
      .maybeSingle();
    if (fallbackError) throw fallbackError;
    return locationFromVenueTeamRow(
      unwrapOne<VenueTeamRow>(fallback?.home_team),
    );
  }

  if (matchError) throw matchError;
  if (!matchRow) return null;

  const hostingTeamId =
    typeof matchRow.hosting_team_id === "string"
      ? matchRow.hosting_team_id
      : null;
  const homeTeamId =
    typeof matchRow.home_team_id === "string"
      ? matchRow.home_team_id
      : match.home_team_id;
  const hostId = venueTeamIdForMatch({
    home_team_id: homeTeamId,
    hosting_team_id: hostingTeamId,
  });

  const teamRow =
    hostId === homeTeamId
      ? unwrapOne<VenueTeamRow>(matchRow.home_team)
      : unwrapOne<VenueTeamRow>(matchRow.away_team);

  return locationFromVenueTeamRow(teamRow);
}
