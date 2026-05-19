import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ groupId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { groupId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);

    const { data, error } = await supabase
      .from("matches")
      .select(
        `
        id,
        round,
        datetime,
        home_team:teams!matches_home_team_id_fkey (id, name),
        away_team:teams!matches_away_team_id_fkey (id, name)
      `,
      )
      .eq("group_id", groupId)
      .order("round", { ascending: true })
      .order("datetime", { ascending: true });

    if (error) return jsonError(error.message, 500);

    return jsonOk({ matches: data ?? [] });
  } catch (err) {
    return jsonFromError(err);
  }
}
