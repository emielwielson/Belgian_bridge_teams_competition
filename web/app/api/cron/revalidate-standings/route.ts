import { createClient } from "@supabase/supabase-js";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

/**
 * Ops hook to bust standings unstable_cache tags after manual fixture changes.
 * Hard refresh alone does not invalidate Next.js Data Cache.
 *
 * Header: x-ops-secret: SUPABASE_SECRET_KEY
 * Body: { "groupIds": ["uuid", ...] }
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret) {
      return jsonErrorCode(ErrorCodes.api.supabaseNotConfigured, 503);
    }

    const provided = request.headers.get("x-ops-secret");
    if (provided !== secret) {
      return jsonErrorCode(ErrorCodes.api.unauthorized, 401);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
      return jsonErrorCode(ErrorCodes.api.supabaseNotConfigured, 503);
    }

    const body = await request.json().catch(() => ({}));
    const groupIds = Array.isArray(body.groupIds)
      ? body.groupIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];

    if (groupIds.length === 0) {
      return jsonError("groupIds required", 400);
    }

    const supabase = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (const groupId of groupIds) {
      await revalidateStandingsForGroup(supabase, groupId);
    }

    return jsonOk({ revalidated: true, groupIds });
  } catch (err) {
    return jsonFromError(err);
  }
}
