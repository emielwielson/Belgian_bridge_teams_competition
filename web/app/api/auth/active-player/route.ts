import { setActivePlayer } from "@/lib/auth/active-player";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createSessionClient } from "@/lib/supabase/server-client";

export async function POST(request: Request) {
  try {
    const supabase = await createSessionClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonErrorCode(ErrorCodes.api.unauthorized, 401);
    }

    const body = await request.json();
    const playerId = body?.player_id;
    if (typeof playerId !== "string" || !playerId) {
      return jsonError("player_id is required", 400);
    }

    await setActivePlayer(supabase, playerId);
    return jsonOk({ activePlayerId: playerId });
  } catch (err) {
    return jsonFromError(err);
  }
}
