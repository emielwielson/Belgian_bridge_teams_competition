import { getLocale } from "next-intl/server";
import { assertArbiterInboxApiAccess } from "@/lib/auth/arbiter-scope";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { assignArbiterRequest } from "@/lib/competition/arbiter-request";
import {
  jsonError,
  jsonFromError,
  jsonOk,
  jsonErrorCode,
} from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { sendArbiterRequestAssignedEmail } from "@/lib/notifications/arbiter-request-email";

type Params = { params: Promise<{ requestId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { requestId } = await params;
    const { user, roles, supabase } = await requireRoles([
      ...ARBITER_ACCESS_ROLES,
    ]);
    await assertArbiterInboxApiAccess(supabase, user.id, roles);

    const body = (await request.json()) as Record<string, unknown>;
    const arbiterUserId = String(
      body.arbiter_user_id ?? body.arbiterUserId ?? "",
    ).trim();
    if (!arbiterUserId) {
      return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
    }

    await assignArbiterRequest(supabase, requestId, arbiterUserId);

    const locale = await getLocale();
    await sendArbiterRequestAssignedEmail(
      {
        requestId,
        assignedArbiterId: arbiterUserId,
      },
      locale,
    );

    return jsonOk({ assigned: true, assignedArbiterId: arbiterUserId });
  } catch (err) {
    if (err instanceof Error && /not found/i.test(err.message)) {
      return jsonError(err.message, 404);
    }
    return jsonFromError(err);
  }
}
