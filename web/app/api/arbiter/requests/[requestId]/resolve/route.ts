import { ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { resolveArbiterRequest } from "@/lib/competition/arbiter-request";
import { jsonFromError, jsonOk } from "@/lib/http/api-response";
import { sendArbiterRequestResolvedEmail } from "@/lib/notifications/arbiter-request-email";

type Params = { params: Promise<{ requestId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { requestId } = await params;
    const { supabase } = await requireRoles([ROLES.ARBITER, ROLES.COMPETITION_MANAGER]);

    await resolveArbiterRequest(supabase, requestId);
    void sendArbiterRequestResolvedEmail({ requestId });

    return jsonOk({ resolved: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
