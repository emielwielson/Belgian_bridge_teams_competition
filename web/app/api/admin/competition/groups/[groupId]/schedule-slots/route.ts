import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import {
  loadGroupScheduleSlots,
  saveGroupScheduleSlots,
  type ScheduleSlotPayload,
} from "@/lib/competition/group-schedule-slots";
import { requireActiveSeason } from "@/lib/competition/season";
import { requireSeasonInSetup } from "@/lib/competition/season-setup";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ groupId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { groupId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);

    const state = await loadGroupScheduleSlots(supabase, groupId);

    if (state.teamCount < 7 || state.teamCount > 8) {
      return jsonOk({
        applicable: false,
        teamCount: state.teamCount,
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
    const season = await requireActiveSeason(supabase);
    requireSeasonInSetup(season);

    const body = await request.json();
    const slots = body.slots as ScheduleSlotPayload[] | undefined;
    if (!Array.isArray(slots)) {
      return jsonError("slots array required", 400);
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
