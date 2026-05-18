import { COMPETITION_ADMIN_ROLES, requireRoles } from "@/lib/auth/route-auth";
import { invokeEdgeFunction } from "@/lib/http/edge-function";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";
type Params = { params: Promise<{ groupId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { groupId } = await params;
    const { supabase } = await requireRoles([...COMPETITION_ADMIN_ROLES]);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return jsonError("No session token", 401);
    }

    const body = await request.json().catch(() => ({}));
    const result = await invokeEdgeFunction<{
      matchesCreated: number;
      rounds: number;
    }>("schedule-generate-rbbf", {
      groupId,
      boardCount: body.boardCount ?? 24,
    }, session.access_token);

    return jsonOk(result);
  } catch (err) {
    return jsonFromError(err);
  }
}
