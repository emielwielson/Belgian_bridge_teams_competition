import { createClient } from "@supabase/supabase-js";
import { revalidateStandingsForGroup } from "@/lib/competition/revalidate-standings";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";

/**
 * Automation hook for Make.com / cron: awards 12 VP for regional bye rounds
 * after the competition match date has passed.
 *
 * Header: x-award-bye-secret: AWARD_BYE_SCORES_SECRET
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.AWARD_BYE_SCORES_SECRET;
    if (!secret) {
      return jsonErrorCode(ErrorCodes.api.awardByeSecretNotConfigured, 503);
    }

    const provided = request.headers.get("x-award-bye-secret");
    if (provided !== secret) {
      return jsonErrorCode(ErrorCodes.api.unauthorized, 401);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SECRET_KEY;
    if (!url || !serviceKey) {
      return jsonErrorCode(ErrorCodes.api.supabaseNotConfigured, 503);
    }

    const body = await request.json().catch(() => ({}));
    const seasonId =
      typeof body.seasonId === "string" ? body.seasonId : null;

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.rpc("award_due_bye_scores", {
      p_season_id: seasonId,
    });

    if (error) return jsonError(error.message, 400);

    const row = Array.isArray(data) ? data[0] : data;
    const groupIds = (row?.group_ids ?? []) as string[];

    for (const groupId of groupIds) {
      await revalidateStandingsForGroup(supabase, groupId);
    }

    return jsonOk({
      awarded: row?.awarded ?? 0,
      pending: row?.pending ?? 0,
      groupIds,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
