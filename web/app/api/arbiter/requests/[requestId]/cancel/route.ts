import { assertArbiterInboxApiAccess } from "@/lib/auth/arbiter-scope";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { cancelArbiterRequest } from "@/lib/competition/arbiter-request";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ requestId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { requestId } = await params;
    const { user, roles, supabase } = await requireRoles([
      ...ARBITER_ACCESS_ROLES,
    ]);
    await assertArbiterInboxApiAccess(supabase, user.id, roles);

    const { data: arbiterRequest, error: requestError } = await supabase
      .from("arbiter_requests")
      .select("id, match:matches ( group_id )")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError) return jsonError(requestError.message, 500);

    await cancelArbiterRequest(supabase, requestId);

    const matchRaw = arbiterRequest?.match as
      | { group_id: string }
      | { group_id: string }[]
      | null
      | undefined;
    const matchRow = Array.isArray(matchRaw) ? matchRaw[0] : matchRaw;
    if (matchRow?.group_id) {
      await revalidateStandingsForGroup(supabase, matchRow.group_id);
    }

    return jsonOk({ cancelled: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
