import { assertManagesClub } from "@/lib/auth/competition-scope";
import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

function parseCompetitionLocation(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clubId: string }> },
) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const { clubId } = await context.params;
    if (!clubId) return jsonErrorCode(ErrorCodes.api.idRequired, 400);
    await assertManagesClub(supabase, clubId);

    const body = await request.json();
    if ("location" in body) {
      return jsonErrorCode(ErrorCodes.api.invalidPatch, 400);
    }

    const competitionLocation = parseCompetitionLocation(body.competition_location);
    if (competitionLocation === undefined) {
      return jsonErrorCode(ErrorCodes.api.noFieldsToUpdate, 400);
    }

    const { data, error } = await supabase
      .from("clubs")
      .update({ competition_location: competitionLocation })
      .eq("id", clubId)
      .is("deleted_at", null)
      .select("id, name, location, competition_location, region_id")
      .maybeSingle();

    if (error) return jsonError(error.message, 400);
    if (!data) return jsonErrorCode(ErrorCodes.api.clubNotFound, 404);

    return jsonOk({ club: data });
  } catch (err) {
    return jsonFromError(err);
  }
}
