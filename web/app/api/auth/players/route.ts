import {
  getActivePlayer,
  getActivePlayerId,
  getLinkedPlayers,
} from "@/lib/auth/active-player";
import { jsonError, jsonFromError, jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { createSessionClient } from "@/lib/supabase/server-client";

export async function GET() {
  try {
    const supabase = await createSessionClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonErrorCode(ErrorCodes.api.unauthorized, 401);
    }

    const [linkedPlayers, activePlayerId, activePlayer] = await Promise.all([
      getLinkedPlayers(supabase, user.id),
      getActivePlayerId(supabase, user.id),
      getActivePlayer(supabase, user.id),
    ]);

    return jsonOk({
      linkedPlayers,
      activePlayerId,
      activePlayer,
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
