import { assertManagesCompetitionUnit } from "@/lib/auth/competition-scope";
import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { fetchMissingScores } from "@/lib/competition/missing-scores";
import { requireActiveSeason } from "@/lib/competition/season";
import type { CompetitionUnit } from "@/lib/competition/scope-setup";
import {
  parseRegionParam,
  parseScopeParam,
  SCOPES,
} from "@/lib/competition/scopes";
import { jsonErrorCode, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

export async function GET(request: Request) {
  try {
    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    const { searchParams } = new URL(request.url);
    const scope = parseScopeParam(searchParams.get("scope") ?? "");
    if (!scope) {
      return jsonErrorCode(ErrorCodes.api.invalidScope, 400);
    }

    let unit: CompetitionUnit;
    if (scope === SCOPES.NATIONAL) {
      unit = { scope: SCOPES.NATIONAL };
    } else {
      const regionCode = parseRegionParam(searchParams.get("region") ?? "");
      if (!regionCode) {
        return jsonErrorCode(ErrorCodes.api.invalidRegionCode, 400);
      }
      unit = { scope: SCOPES.REGIONAL, regionCode };
    }

    await assertManagesCompetitionUnit(supabase, user.id, roles, unit);
    const season = await requireActiveSeason(supabase);
    const result = await fetchMissingScores(supabase, season.id, unit);
    return jsonOk(result);
  } catch (err) {
    return jsonFromError(err);
  }
}
