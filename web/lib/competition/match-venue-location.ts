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

/**
 * Competition venue for a match: hosting team's resolved location.
 * Callers should skip Honor Division matches.
 */
export async function loadMatchVenueLocation(
  supabase: SupabaseClient,
  match: { id: string; home_team_id: string },
): Promise<string | null> {
  let hostingTeamId: string | null = null;

  const { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .select("home_team_id, hosting_team_id")
    .eq("id", match.id)
    .maybeSingle();

  if (isMissingHostingTeamIdColumn(matchError)) {
    hostingTeamId = null;
  } else if (matchError) {
    throw matchError;
  } else {
    hostingTeamId =
      typeof matchRow?.hosting_team_id === "string"
        ? matchRow.hosting_team_id
        : null;
  }

  const teamId = venueTeamIdForMatch({
    home_team_id: match.home_team_id,
    hosting_team_id: hostingTeamId,
  });

  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select(
      `
      id,
      location,
      club:clubs(address, postal_code, location, competition_location),
      group:groups (
        division:divisions (
          centralized_location
        )
      )
    `,
    )
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) throw teamError;
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
