import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { generateGroupScheduleInDb } from "@/lib/scheduling/generate-group-schedule-db";

type Params = { params: Promise<{ groupId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { groupId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);

    const body = await request.json().catch(() => ({}));
    const boardCount =
      typeof body.boardCount === "number" ? body.boardCount : 24;

    const result = await generateGroupScheduleInDb(
      supabase,
      groupId,
      boardCount,
    );

    return jsonOk(result);
  } catch (err) {
    return jsonFromError(err);
  }
}
