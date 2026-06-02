import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { fetchRegionalReadiness } from "@/lib/competition/regional-readiness";
import { requireActiveSeason } from "@/lib/competition/season";
import { parseRegionParam } from "@/lib/competition/scopes";
import { jsonErrorCode, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

export async function GET(request: Request) {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const season = await requireActiveSeason(supabase);
    const { searchParams } = new URL(request.url);
    const regionCode = parseRegionParam(searchParams.get("region") ?? "");
    if (!regionCode) {
      return jsonErrorCode(ErrorCodes.api.invalidRegionCode, 400);
    }
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
