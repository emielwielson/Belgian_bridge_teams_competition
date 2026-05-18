import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { fetchNationalReadiness } from "@/lib/competition/national-readiness";
import { requireActiveSeason } from "@/lib/competition/season";
import { jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET() {
  try {
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    const season = await requireActiveSeason(supabase);
    const readiness = await fetchNationalReadiness(supabase, season.id);
    return jsonOk(readiness);
  } catch (err) {
    return jsonFromError(err);
  }
}
