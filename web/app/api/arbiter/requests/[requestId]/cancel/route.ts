import { assertArbiterInboxApiAccess } from "@/lib/auth/arbiter-scope";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { cancelArbiterRequest } from "@/lib/competition/arbiter-request";
import { jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ requestId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { requestId } = await params;
    const { user, roles, supabase } = await requireRoles([
      ...ARBITER_ACCESS_ROLES,
    ]);
    await assertArbiterInboxApiAccess(supabase, user.id, roles);

    await cancelArbiterRequest(supabase, requestId);

    return jsonOk({ cancelled: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
