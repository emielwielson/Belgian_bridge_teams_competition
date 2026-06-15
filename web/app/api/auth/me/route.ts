import { getActivePlayer, getLinkedPlayers } from "@/lib/auth/active-player";
import { getUserRoles } from "@/lib/auth/session";
import { loadTeamsForUser } from "@/lib/competition/team-queries";
import { jsonOk, jsonErrorCode } from "@/lib/http/api-response";
import { ErrorCodes } from "@/lib/http/error-codes";
import { getUserPreferredLocale } from "@/lib/i18n/user-locale";
import { createSessionClient } from "@/lib/supabase/server-client";

export async function GET() {
  const supabase = await createSessionClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonErrorCode(ErrorCodes.api.unauthorized, 401);
  }

  const [roles, teams, preferredLocale, activePlayer, linkedPlayers] =
    await Promise.all([
      getUserRoles(supabase, user.id),
      loadTeamsForUser(supabase, user.id),
      getUserPreferredLocale(supabase, user.id),
      getActivePlayer(supabase, user.id),
      getLinkedPlayers(supabase, user.id),
    ]);
  return jsonOk({
    user: { id: user.id, email: user.email },
    roles,
    teams,
    preferredLocale,
    activePlayer,
    linkedPlayers,
  });
}
