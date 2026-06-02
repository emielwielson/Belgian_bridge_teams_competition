import { getLocale } from "next-intl/server";
import { requireAuth } from "@/lib/auth/route-auth";
import {
  canAccessArbiterRequestWorkflow,
  createArbiterRequest,
  getMatchArbiterRequestsState,
} from "@/lib/competition/arbiter-request";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { sendArbiterRequestCreatedEmail } from "@/lib/notifications/arbiter-request-email";

type Params = { params: Promise<{ matchId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    const state = await getMatchArbiterRequestsState(supabase, matchId);

    if (!state) {
      return jsonErrorCode(ErrorCodes.api.matchNotFound, 404);
    }

    if (!canAccessArbiterRequestWorkflow(state)) {
      return jsonErrorCode(ErrorCodes.api.forbidden, 403);
    }

    return jsonOk({ state });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Forbidden")) {
      return jsonErrorCode(ErrorCodes.api.forbidden, 403);
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
      return jsonErrorCode(ErrorCodes.api.imagePathRequired, 400);
    }

    await createArbiterRequest(supabase, matchId, imagePath);

    const state = await getMatchArbiterRequestsState(supabase, matchId);

    const locale = await getLocale();
    void sendArbiterRequestCreatedEmail({ matchId }, locale);

    return jsonOk({ state });
  } catch (err) {
    return jsonFromError(err);
  }
}
