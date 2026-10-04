import { requireRoles } from "@/lib/auth/route-auth";
import { ROLES } from "@/lib/auth/roles";
import {
  createOrEnsureCompetitionManager,
  listCompetitionManagers,
  parseKindCodes,
} from "@/lib/admin/competition-managers";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createServiceClient } from "@/lib/supabase/server-client";

export async function GET() {
  try {
    await requireRoles([ROLES.SYSTEM_ADMIN]);
    const service = createServiceClient();
    const managers = await listCompetitionManagers(service);
    return jsonOk({ managers });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireRoles([ROLES.SYSTEM_ADMIN]);
    const body = (await request.json()) as Record<string, unknown>;
    const email = String(body.email ?? "").trim();
    const displayName = String(body.displayName ?? body.display_name ?? "").trim();
    if (!email || !displayName) {
      return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
    }
    const kinds = parseKindCodes(body.kinds);
    const isGlobal = Boolean(body.isGlobal);
    const service = createServiceClient();
    const manager = await createOrEnsureCompetitionManager({
      service,
      email,
      displayName,
      kinds,
      isGlobal,
    });
    return jsonOk({ manager });
  } catch (err) {
    if (err instanceof Error && err.message === "Invalid email") {
      return jsonError(err.message, 400);
    }
    if (err instanceof Error && err.message === "Display name is required") {
      return jsonError(err.message, 400);
    }
    if (err instanceof Error && err.message === "Failed to create auth user") {
      return jsonError(err.message, 500);
    }
    return jsonFromError(err);
  }
}
