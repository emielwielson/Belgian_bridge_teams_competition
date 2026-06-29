import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import {
  loadGroupMatchRoundConfig,
  saveGroupSkippedRounds,
} from "@/lib/competition/group-match-rounds";
import { requireGroupInSetup } from "@/lib/competition/scope-setup";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

type Params = { params: Promise<{ groupId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { groupId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);

    const config = await loadGroupMatchRoundConfig(supabase, groupId);
    return jsonOk(config);
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { groupId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    await requireGroupInSetup(supabase, groupId);

    const body = await request.json();
    const skippedRounds = body.skippedRounds as number[] | undefined;
    if (!Array.isArray(skippedRounds)) {
      return jsonErrorCode(ErrorCodes.api.skippedRoundsRequired, 400);
    }

    await saveGroupSkippedRounds(supabase, groupId, skippedRounds);
    const config = await loadGroupMatchRoundConfig(supabase, groupId);

    return jsonOk(config);
  } catch (err) {
    return jsonFromError(err);
  }
}
