import { requireAuth } from "@/lib/auth/route-auth";
import {
  canAccessArbiterRequestWorkflow,
  createArbiterRequest,
  getMatchArbiterRequestsState,
} from "@/lib/competition/arbiter-request";
import { jsonError, jsonFromError, jsonOk } from "@/lib/http/api-response";
import { sendArbiterRequestCreatedEmail } from "@/lib/notifications/arbiter-request-email";

type Params = { params: Promise<{ matchId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    const state = await getMatchArbiterRequestsState(supabase, matchId);

    if (!state) {
      return jsonError("Match not found", 404);
    }

    if (!canAccessArbiterRequestWorkflow(state)) {
      return jsonError("Forbidden", 403);
    }

    return jsonOk({ state });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Forbidden")) {
      return jsonError("Forbidden", 403);
    }
    return jsonFromError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    const body = (await request.json()) as Record<string, unknown>;

    const imagePath = String(
      body.image_path ?? body.imagePath ?? "",
    ).trim();

    if (!imagePath) {
      return jsonError("image_path is required", 400);
    }

    await createArbiterRequest(supabase, matchId, imagePath);

    const state = await getMatchArbiterRequestsState(supabase, matchId);

    void sendArbiterRequestCreatedEmail({ matchId });

    return jsonOk({ state });
  } catch (err) {
    return jsonFromError(err);
  }
}
