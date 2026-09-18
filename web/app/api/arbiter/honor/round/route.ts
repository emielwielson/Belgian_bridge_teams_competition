import { assertArbiterHonorApiAccess } from "@/lib/auth/arbiter-scope";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import {
  defaultHonorRound,
  honorRoundOptions,
  loadHonorRoundMeta,
  loadHonorRoundSeating,
  matchDayForHonorRound,
  resolveActiveHonorGroup,
} from "@/lib/competition/honor-seating-overview";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";

export async function GET(request: Request) {
  try {
    const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    await assertArbiterHonorApiAccess(supabase, user.id, roles);
    const group = await resolveActiveHonorGroup(supabase);
    if (!group) {
      return jsonError("Honor division group not found for the active season", 404);
    }

    const url = new URL(request.url);
    const roundParam = url.searchParams.get("round");
    const meta = await loadHonorRoundMeta(supabase, group.id);
    const requestedRound = roundParam ? Number(roundParam) : NaN;
    const round =
      Number.isInteger(requestedRound) &&
      requestedRound >= 1 &&
      requestedRound <= group.round_count
        ? requestedRound
        : defaultHonorRound(meta);

    const seating = await loadHonorRoundSeating(supabase, group, round);

    return jsonOk({
      group_id: group.id,
      round,
      round_count: group.round_count,
      match_day: matchDayForHonorRound(round),
      phase: seating.phase,
      round_options: honorRoundOptions(group.round_count),
      matches: seating.matches,
      tables: seating.tables,
      can_unlock: true,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
