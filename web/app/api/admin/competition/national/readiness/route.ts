import { assertManagesCompetitionUnit } from "@/lib/auth/competition-scope";
import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { fetchNationalReadiness } from "@/lib/competition/national-readiness";
import { requireActiveSeason } from "@/lib/competition/season";
import { SCOPES } from "@/lib/competition/scopes";
import { jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET() {
  try {
    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    await assertManagesCompetitionUnit(supabase, user.id, roles, {
      scope: SCOPES.NATIONAL,
    });
    const season = await requireActiveSeason(supabase);
    const readiness = await fetchNationalReadiness(supabase, season.id);
    return jsonOk(readiness);
  } catch (err) {
    return jsonFromError(err);
  }
}
