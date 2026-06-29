import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import {
  loadGroupScheduleSlots,
  saveGroupScheduleSlots,
  type ScheduleSlotPayload,
} from "@/lib/competition/group-schedule-slots";
import { requireGroupInSetup } from "@/lib/competition/scope-setup";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

type Params = { params: Promise<{ groupId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { groupId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);

    const state = await loadGroupScheduleSlots(supabase, groupId);

    if (state.teamCount < 7 || state.teamCount > 8) {
      return jsonOk({
        applicable: false,
        ...state,
      });
    }

    return jsonOk({
      applicable: true,
      ...state,
    });
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
    const slots = body.slots as ScheduleSlotPayload[] | undefined;
    if (!Array.isArray(slots)) {
      return jsonErrorCode(ErrorCodes.api.slotsArrayRequired, 400);
    }

    await saveGroupScheduleSlots(supabase, groupId, slots);
    const state = await loadGroupScheduleSlots(supabase, groupId, {
      autoSeed: false,
    });

    return jsonOk(state);
  } catch (err) {
    return jsonFromError(err);
  }
}
