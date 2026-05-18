import { createSessionClient } from "@/lib/supabase/server-client";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ groupId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { groupId } = await params;
    const supabase = await createSessionClient();

    const { data, error } = await supabase
      .from("standings_group")
      .select("group_id, team_id, team_name, vp_total")
      .eq("group_id", groupId)
      .order("vp_total", { ascending: false });

    if (error) return jsonError(error.message, 500);
    return jsonOk({ groupId, standings: data ?? [] });
  } catch (err) {
    return jsonFromError(err);
  }
}
