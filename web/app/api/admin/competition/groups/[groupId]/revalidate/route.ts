import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { jsonFromError, jsonOk } from "@/lib/http/api-response";

type Params = { params: Promise<{ groupId: string }> };

/** Bust cached standings/match links after manual fixture or date changes. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { groupId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);
    await revalidateStandingsForGroup(supabase, groupId);
    return jsonOk({ revalidated: true, groupId });
  } catch (err) {
    return jsonFromError(err);
  }
}
