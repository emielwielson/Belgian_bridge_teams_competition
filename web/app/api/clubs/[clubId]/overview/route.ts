import { requireAuth } from "@/lib/auth/route-auth";
import { assertClubManagerForClub } from "@/lib/auth/user-access";
import { loadClubOverview } from "@/lib/competition/club-manager-queries";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ clubId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { clubId } = await params;
    const { user, roles, supabase } = await requireAuth();
    await assertClubManagerForClub(supabase, user.id, roles, clubId);

    const overview = await loadClubOverview(supabase, clubId);
    if (!overview) return jsonError("Club not found", 404);

    return jsonOk(overview);
  } catch (err) {
    return jsonFromError(err);
  }
}
