import { requireAuth } from "@/lib/auth/route-auth";
import { loadScorableMatchesForUser } from "@/lib/competition/player-matches";
import { jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET() {
  try {
    const { user, roles, supabase } = await requireAuth();
    const matches = await loadScorableMatchesForUser(supabase, user.id, roles);
    return jsonOk({ matches });
  } catch (err) {
    return jsonFromError(err);
  }
}
