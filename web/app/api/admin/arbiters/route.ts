import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import {
  createOrEnsureArbiter,
  listArbitersForManager,
  loadCallerManagedKinds,
  parseKindCodes,
} from "@/lib/admin/arbiters";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createServiceClient } from "@/lib/supabase/server-client";
import { managerCanGrantHonor } from "@/lib/auth/arbiter-scope";

export async function GET() {
  try {
    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    const managed = await loadCallerManagedKinds(supabase, user.id, roles);
    const service = createServiceClient();
    const arbiters = await listArbitersForManager(service, managed);
    return jsonOk({
      arbiters,
      canGrantHonor: managerCanGrantHonor(managed),
      managedKinds: managed.kindCodes,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, roles, supabase } = await requireRoles([
      ...COMPETITION_ADMIN_ROLES,
    ]);
    const managed = await loadCallerManagedKinds(supabase, user.id, roles);
    const body = (await request.json()) as Record<string, unknown>;
    const email = String(body.email ?? "").trim();
    if (!email) {
      return jsonErrorCode(ErrorCodes.api.invalidRequestBody, 400);
    }
    const kinds = parseKindCodes(body.kinds);
    const honor = Boolean(body.honor);
    const service = createServiceClient();
    const arbiter = await createOrEnsureArbiter({
      service,
      managed,
      email,
      kinds,
      honor,
    });
    return jsonOk({ arbiter });
  } catch (err) {
    if (err instanceof Error && err.message === "Invalid email") {
      return jsonError(err.message, 400);
    }
    if (err instanceof Error && err.message === "Failed to create auth user") {
      return jsonError(err.message, 500);
    }
    return jsonFromError(err);
  }
}
