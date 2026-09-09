import { assertManagesCompetitionUnit } from "@/lib/auth/competition-scope";
import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { fetchRegionalReadiness } from "@/lib/competition/regional-readiness";
import { requireActiveSeason } from "@/lib/competition/season";
import { parseRegionParam, SCOPES } from "@/lib/competition/scopes";
import { jsonErrorCode, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

export async function GET(request: Request) {
  try {
    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    const season = await requireActiveSeason(supabase);
    const { searchParams } = new URL(request.url);
    const regionCode = parseRegionParam(searchParams.get("region") ?? "");
    if (!regionCode) {
      return jsonErrorCode(ErrorCodes.api.invalidRegionCode, 400);
    }
    await assertManagesCompetitionUnit(supabase, user.id, roles, {
      scope: SCOPES.REGIONAL,
      regionCode,
    });
    const readiness = await fetchRegionalReadiness(
      supabase,
      season.id,
      regionCode,
    );
    return jsonOk(readiness);
  } catch (err) {
    return jsonFromError(err);
  }
}
