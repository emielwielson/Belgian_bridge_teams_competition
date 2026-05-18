import { fetchGroupStandings } from "@/lib/competition/standings-queries";
import { createSessionClient } from "@/lib/supabase/server-client";
import { jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ groupId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { groupId } = await params;
    const supabase = await createSessionClient();
    const standings = await fetchGroupStandings(supabase, groupId);
    return jsonOk({ groupId, standings });
  } catch (err) {
    return jsonFromError(err);
  }
}
