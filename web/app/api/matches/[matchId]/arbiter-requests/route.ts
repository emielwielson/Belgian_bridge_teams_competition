import { getLocale } from "next-intl/server";
import { requireAuth } from "@/lib/auth/route-auth";
import {
  canAccessArbiterRequestWorkflow,
  createArbiterRequest,
  loadMatchArbiterRequestsForUser,
  normalizeArbiterRequestImagePaths,
} from "@/lib/competition/arbiter-request";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { sendArbiterRequestCreatedEmail } from "@/lib/notifications/arbiter-request-email";

type Params = { params: Promise<{ matchId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const { supabase } = await requireAuth();
    const { state, canSubmitScore } = await loadMatchArbiterRequestsForUser(
      supabase,
      matchId,
    );

    if (!state) {
      return jsonErrorCode(ErrorCodes.api.matchNotFound, 404);
    }

    if (!canAccessArbiterRequestWorkflow(state, canSubmitScore)) {
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

    const imagePaths = normalizeArbiterRequestImagePaths(body);
    if ("error" in imagePaths) {
      if (imagePaths.error === "too_many") {
        return jsonErrorCode(ErrorCodes.api.imagePathsTooMany, 400);
      }
      return jsonErrorCode(ErrorCodes.api.imagePathRequired, 400);
    }

    await createArbiterRequest(supabase, matchId, imagePaths);

    const { state } = await loadMatchArbiterRequestsForUser(supabase, matchId);

    const { data: match } = await supabase
      .from("matches")
      .select("group_id")
      .eq("id", matchId)
      .maybeSingle();
    if (match?.group_id) {
      await revalidateStandingsForGroup(supabase, match.group_id);
    }

    const locale = await getLocale();
    await sendArbiterRequestCreatedEmail({ matchId }, locale);

    return jsonOk({ state });
  } catch (err) {
    return jsonFromError(err);
  }
}
