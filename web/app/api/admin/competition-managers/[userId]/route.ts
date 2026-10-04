import { requireRoles } from "@/lib/auth/route-auth";
import { ROLES } from "@/lib/auth/roles";
import {
  parseKindCodes,
  removeCompetitionManager,
  updateCompetitionManagerScopes,
} from "@/lib/admin/competition-managers";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createServiceClient } from "@/lib/supabase/server-client";

type Params = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { userId } = await params;
    if (!userId) return jsonErrorCode(ErrorCodes.api.idRequired, 400);

    await requireRoles([ROLES.SYSTEM_ADMIN]);
    const body = (await request.json()) as Record<string, unknown>;
    const kinds = parseKindCodes(body.kinds);
    const isGlobal = Boolean(body.isGlobal);
    const displayNameRaw = body.displayName ?? body.display_name;
    const displayName =
      displayNameRaw != null ? String(displayNameRaw).trim() : undefined;
    if (displayName !== undefined && !displayName) {
      return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
    }
    const service = createServiceClient();
    const manager = await updateCompetitionManagerScopes({
      service,
      userId,
      displayName,
      kinds,
      isGlobal,
    });
    return jsonOk({ manager });
  } catch (err) {
    if (err instanceof Error && err.message === "Competition manager not found") {
      return jsonError(err.message, 404);
    }
    if (err instanceof Error && err.message === "Display name is required") {
      return jsonError(err.message, 400);
    }
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { userId } = await params;
    if (!userId) return jsonErrorCode(ErrorCodes.api.idRequired, 400);

    await requireRoles([ROLES.SYSTEM_ADMIN]);
    const service = createServiceClient();
    await removeCompetitionManager({ service, userId });
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
