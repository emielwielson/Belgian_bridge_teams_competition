import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import {
  loadCallerManagedKinds,
  parseKindCodes,
  removeArbiter,
  updateArbiterScopes,
} from "@/lib/admin/arbiters";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createServiceClient } from "@/lib/supabase/server-client";

type Params = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { userId } = await params;
    if (!userId) return jsonErrorCode(ErrorCodes.api.idRequired, 400);

    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    const managed = await loadCallerManagedKinds(supabase, user.id, roles);
    const body = (await request.json()) as Record<string, unknown>;
    const kinds = parseKindCodes(body.kinds);
    const honor = Boolean(body.honor);
    const service = createServiceClient();
    const arbiter = await updateArbiterScopes({
      service,
      managed,
      userId,
      kinds,
      honor,
    });
    return jsonOk({ arbiter });
  } catch (err) {
    if (err instanceof Error && err.message === "Arbiter not found") {
      return jsonError(err.message, 404);
    }
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { userId } = await params;
    if (!userId) return jsonErrorCode(ErrorCodes.api.idRequired, 400);

    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    const managed = await loadCallerManagedKinds(supabase, user.id, roles);
    const service = createServiceClient();
    await removeArbiter({ service, managed, userId });
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
