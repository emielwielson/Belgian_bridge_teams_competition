import { getLocale } from "next-intl/server";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { resolveArbiterRequest } from "@/lib/competition/arbiter-request";
import { createOperationalSignedUrl } from "@/lib/files/operational-file-storage";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
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

    const rulingId = await resolveArbiterRequest(supabase, requestId, {
      filePath,
    });

    const service = createServiceClient();
    const { data: ruling, error: rulingError } = await supabase
      .from("rulings")
      .select("file_path")
      .eq("id", rulingId)
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

    const locale = await getLocale();
    void sendArbiterRequestResolvedEmail(
      {
        requestId,
        rulingSignedUrl,
      },
      locale,
    );

    return jsonOk({ resolved: true, rulingId, rulingSignedUrl });
  } catch (err) {
    return jsonFromError(err);
  }
}
