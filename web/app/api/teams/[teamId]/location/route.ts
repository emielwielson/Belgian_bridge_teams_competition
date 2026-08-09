import { requireAuth } from "@/lib/auth/route-auth";
import { assertCanManageTeamLocation } from "@/lib/auth/team-access";
import {
  resolveClubMatchLocation,
  resolveTeamMatchLocation,
} from "@/lib/competition/team-location";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createServiceClient } from "@/lib/supabase/server-client";

type TeamParams = { params: Promise<{ teamId: string }> };

function parseLocation(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(request: Request, { params }: TeamParams) {
  try {
    const { teamId } = await params;
    const { user, roles, supabase } = await requireAuth();

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select(
        `
        id,
        club_id,
        club:clubs(id, name, address, postal_code, location, competition_location),
        group:groups(
          id,
          division:divisions(centralized_location)
        )
      `,
      )
      .eq("id", teamId)
      .maybeSingle();

    if (teamError) throw teamError;
    if (!team) return jsonErrorCode(ErrorCodes.api.teamNotFound, 404);

    await assertCanManageTeamLocation(
      supabase,
      user.id,
      roles,
      teamId,
      team.club_id,
    );

    const rawGroup = team.group as unknown;
    const group = Array.isArray(rawGroup) ? rawGroup[0] : rawGroup;
    const rawDivision =
      group && typeof group === "object"
        ? (group as { division?: unknown }).division
        : null;
    const division = Array.isArray(rawDivision)
      ? (rawDivision[0] as { centralized_location?: string | null } | undefined)
      : (rawDivision as { centralized_location?: string | null } | null);

    const centralized =
      typeof division?.centralized_location === "string"
        ? division.centralized_location.trim()
        : "";
    if (centralized) {
      return jsonErrorCode(ErrorCodes.api.locationCentralizedVenue, 400);
    }

    const body = await request.json();
    const location = parseLocation(body.location);
    if (location === undefined) {
      return jsonErrorCode(ErrorCodes.api.locationFieldRequired, 400);
    }

    const service = createServiceClient();
    const { data: updated, error: updateError } = await service
      .from("teams")
      .update({ location })
      .eq("id", teamId)
      .select("id, location")
      .maybeSingle();

    if (updateError) return jsonError(updateError.message, 400);
    if (!updated) return jsonErrorCode(ErrorCodes.api.teamNotFound, 404);

    const rawClub = team.club as unknown;
    const club = Array.isArray(rawClub)
      ? (rawClub[0] as {
          address?: string | null;
          postal_code?: string | null;
          location?: string | null;
          competition_location?: string | null;
        } | undefined)
      : (rawClub as {
          address?: string | null;
          postal_code?: string | null;
          location?: string | null;
          competition_location?: string | null;
        } | null);

    const locationOverride =
      typeof updated.location === "string" && updated.location.trim()
        ? updated.location.trim()
        : null;

    return jsonOk({
      location: resolveTeamMatchLocation(club, division, {
        location: locationOverride,
      }),
      locationOverride,
      clubLocation: resolveClubMatchLocation(club),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
