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

function isMissingLocationOverrideColumn(error: PostgrestError | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" &&
    typeof error.message === "string" &&
    error.message.includes("location_override")
  );
}

export type MatchVenueLocations = {
  /** Display venue: location_override if set, else hosting team's venue. */
  displayLocation: string | null;
  /** Resolved home-team venue (ignores match override). */
  homeTeamLocation: string | null;
  /** Resolved away-team venue (ignores match override). */
  awayTeamLocation: string | null;
};

/**
 * Competition venues for a match. Callers should skip Honor Division.
 * displayLocation prefers location_override, else hosting team venue.
 */
export async function loadMatchVenueLocations(
  supabase: SupabaseClient,
  match: { id: string; home_team_id: string; away_team_id?: string },
): Promise<MatchVenueLocations> {
  const empty: MatchVenueLocations = {
    displayLocation: null,
    homeTeamLocation: null,
    awayTeamLocation: null,
  };

  const selectWithOverride = `
      home_team_id,
      hosting_team_id,
      location_override,
      home_team:teams!matches_home_team_id_fkey (${TEAM_VENUE_FIELDS}),
      away_team:teams!matches_away_team_id_fkey (${TEAM_VENUE_FIELDS})
    `;
  const selectWithoutOverride = `
      home_team_id,
      hosting_team_id,
      home_team:teams!matches_home_team_id_fkey (${TEAM_VENUE_FIELDS}),
      away_team:teams!matches_away_team_id_fkey (${TEAM_VENUE_FIELDS})
    `;

  let { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .select(selectWithOverride)
    .eq("id", match.id)
    .maybeSingle();

  if (isMissingLocationOverrideColumn(matchError)) {
    const fallbackOverride = await supabase
      .from("matches")
      .select(selectWithoutOverride)
      .eq("id", match.id)
      .maybeSingle();
    matchRow = fallbackOverride.data
      ? { ...fallbackOverride.data, location_override: null }
      : null;
    matchError = fallbackOverride.error;
  }

  if (isMissingHostingTeamIdColumn(matchError)) {
    const { data: fallback, error: fallbackError } = await supabase
      .from("matches")
      .select(
        `
        home_team_id,
        location_override,
        home_team:teams!matches_home_team_id_fkey (${TEAM_VENUE_FIELDS})
      `,
      )
      .eq("id", match.id)
      .maybeSingle();
    if (
      isMissingLocationOverrideColumn(fallbackError) ||
      (fallbackError?.code === "42703" &&
        fallbackError.message.includes("hosting_team_id"))
    ) {
      const legacy = await supabase
        .from("matches")
        .select(
          `
          home_team_id,
          home_team:teams!matches_home_team_id_fkey (${TEAM_VENUE_FIELDS})
        `,
        )
        .eq("id", match.id)
        .maybeSingle();
      if (legacy.error) throw legacy.error;
      const homeTeamLocation = locationFromVenueTeamRow(
        unwrapOne<VenueTeamRow>(legacy.data?.home_team),
      );
      return {
        displayLocation: homeTeamLocation,
        homeTeamLocation,
        awayTeamLocation: null,
      };
    }
    if (fallbackError) throw fallbackError;
    const homeTeamLocation = locationFromVenueTeamRow(
      unwrapOne<VenueTeamRow>(fallback?.home_team),
    );
    const override =
      typeof fallback?.location_override === "string" &&
      fallback.location_override.trim()
        ? fallback.location_override.trim()
        : null;
    return {
      displayLocation: override ?? homeTeamLocation,
      homeTeamLocation,
      awayTeamLocation: null,
    };
  }

  if (matchError) throw matchError;
  if (!matchRow) return empty;

  const homeTeamLocation = locationFromVenueTeamRow(
    unwrapOne<VenueTeamRow>(matchRow.home_team),
  );
  const awayTeamLocation = locationFromVenueTeamRow(
    unwrapOne<VenueTeamRow>(matchRow.away_team),
  );

  const override =
    typeof matchRow.location_override === "string" &&
    matchRow.location_override.trim()
      ? matchRow.location_override.trim()
      : null;
  if (override) {
    return {
      displayLocation: override,
      homeTeamLocation,
      awayTeamLocation,
    };
  }

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

  return {
    displayLocation:
      hostId === homeTeamId ? homeTeamLocation : awayTeamLocation,
    homeTeamLocation,
    awayTeamLocation,
  };
}

/**
 * Competition venue for a match: location_override if set, else hosting team's
 * resolved location. Callers should skip Honor Division.
 */
export async function loadMatchVenueLocation(
  supabase: SupabaseClient,
  match: { id: string; home_team_id: string; away_team_id?: string },
): Promise<string | null> {
  const venues = await loadMatchVenueLocations(supabase, match);
  return venues.displayLocation;
}
