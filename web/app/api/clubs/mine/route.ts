import { requireAuth } from "@/lib/auth/route-auth";
import { loadManagedClubsForUser } from "@/lib/auth/user-access";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET() {
  try {
    const { user, supabase } = await requireAuth();
    const summaries = await loadManagedClubsForUser(supabase, user.id);

    if (summaries.length === 0) {
      return jsonOk({ clubs: [] });
    }

    const { data, error } = await supabase
      .from("clubs")
      .select("id, name, region_id, region:regions(code, name)")
      .in(
        "id",
        summaries.map((c) => c.id),
      )
      .order("name");

    if (error) return jsonError(error.message, 500);
    return jsonOk({ clubs: data ?? [] });
  } catch (err) {
    return jsonFromError(err);
  }
}
