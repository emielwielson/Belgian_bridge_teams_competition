import { assertManagesScopeRegion } from "@/lib/auth/competition-scope";
import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import {
  honorVenuesComplete,
  loadHonorMatchDayVenues,
  loadHonorMatchDays,
  normalizeHonorVenueInputs,
  resolveHonorDivisionId,
  saveHonorMatchDayVenues,
} from "@/lib/competition/honor-match-day-venues";
import { ensureNationalStructure } from "@/lib/competition/ensure-national-structure";
import { requireActiveSeason } from "@/lib/competition/season";
import { SCOPES } from "@/lib/competition/scopes";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

export async function GET() {
  try {
    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    const season = await requireActiveSeason(supabase);
    await assertManagesScopeRegion(
      supabase,
      user.id,
      roles,
      SCOPES.NATIONAL,
    );

    await ensureNationalStructure(supabase, season.id);
    const divisionId = await resolveHonorDivisionId(supabase, season.id);
    if (!divisionId) {
      return jsonErrorCode(ErrorCodes.api.invalidPatch, 404);
    }

    const [venues, matchDays] = await Promise.all([
      loadHonorMatchDayVenues(supabase, divisionId),
      loadHonorMatchDays(supabase, season.id),
    ]);

    return jsonOk({
      divisionId,
      venues,
      matchDays,
      complete: honorVenuesComplete(venues),
      matchDayCount: venues.length,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    const season = await requireActiveSeason(supabase);
    await assertManagesScopeRegion(
      supabase,
      user.id,
      roles,
      SCOPES.NATIONAL,
    );

    const body = await request.json();
    const normalized = normalizeHonorVenueInputs(body?.venues);
    if (!normalized) {
      return jsonErrorCode(ErrorCodes.api.exactlyMatchDays, 400, {
        expected: 7,
        scheduleKey: "honor",
        actual: Array.isArray(body?.venues) ? body.venues.length : 0,
      });
    }

    await ensureNationalStructure(supabase, season.id);
    const divisionId = await resolveHonorDivisionId(supabase, season.id);
    if (!divisionId) {
      return jsonError("Honor Division not found", 404);
    }

    const venues = await saveHonorMatchDayVenues(
      supabase,
      divisionId,
      normalized,
    );

    return jsonOk({
      divisionId,
      venues,
      complete: honorVenuesComplete(venues),
      matchDayCount: venues.length,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
