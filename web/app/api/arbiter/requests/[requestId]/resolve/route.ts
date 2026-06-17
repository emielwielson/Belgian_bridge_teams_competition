import { getLocale } from "next-intl/server";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import {
  buildResolveActionsPayload,
  resolveArbiterRequest,
} from "@/lib/competition/arbiter-request";
import {
  revalidatePlayersForMatch,
  revalidateStandingsForGroup,
} from "@/lib/competition/revalidate-standings";
import { createOperationalSignedUrl } from "@/lib/files/operational-file-storage";
import {
  jsonError,
  jsonFromError,
  jsonOk,
  jsonErrorCode,
} from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { sendArbiterRequestResolvedEmail } from "@/lib/notifications/arbiter-request-email";
import { createServiceClient } from "@/lib/supabase/server-client";

type Params = { params: Promise<{ requestId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { requestId } = await params;
    const { supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);

    const body = (await request.json()) as Record<string, unknown>;
    const filePath = String(body.file_path ?? body.filePath ?? "").trim();
    if (!filePath) {
      return jsonErrorCode(ErrorCodes.api.filePathRequired, 400);
    }

    const { data: arbiterRequest, error: requestError } = await supabase
      .from("arbiter_requests")
      .select("id, match_id, match:matches ( group_id )")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError) return jsonError(requestError.message, 500);
    if (!arbiterRequest) {
      return jsonErrorCode(ErrorCodes.api.matchNotFound, 404);
    }

    const matchRaw = arbiterRequest.match as
      | { group_id: string }
      | { group_id: string }[]
      | null;
    const match = Array.isArray(matchRaw) ? matchRaw[0] : matchRaw;
    if (!match?.group_id) {
      return jsonErrorCode(ErrorCodes.api.matchNotFound, 404);
    }

    const actionsPayload = await buildResolveActionsPayload(
      supabase,
      match.group_id,
      body,
    );
    if ("error" in actionsPayload) {
      return jsonErrorCode(actionsPayload.error, 400);
    }

    const result = await resolveArbiterRequest(supabase, requestId, {
      filePath,
      actions: actionsPayload,
    });

    const service = createServiceClient();
    const { data: ruling, error: rulingError } = await supabase
      .from("rulings")
      .select("file_path")
      .eq("id", result.rulingId)
      .maybeSingle();
    if (rulingError) return jsonError(rulingError.message, 500);

    let rulingSignedUrl: string | null = null;
    if (ruling?.file_path) {
      try {
        rulingSignedUrl = await createOperationalSignedUrl(
          service,
          ruling.file_path,
        );
      } catch {
        rulingSignedUrl = null;
      }
    }

    if (result.score || result.penaltyIds.length > 0) {
      await revalidateStandingsForGroup(supabase, match.group_id);
    }
    if (result.score) {
      await revalidatePlayersForMatch(supabase, arbiterRequest.match_id);
    }

    const locale = await getLocale();
    await sendArbiterRequestResolvedEmail(
      {
        requestId,
        rulingSignedUrl,
      },
      locale,
    );

    return jsonOk({
      resolved: true,
      rulingId: result.rulingId,
      rulingSignedUrl,
      score: result.score,
      penaltyIds: result.penaltyIds,
      warningIds: result.warningIds,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
