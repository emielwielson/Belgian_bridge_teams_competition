import { getUserRoles } from "@/lib/auth/session";
import { loadTeamsForUser } from "@/lib/competition/team-queries";
import { jsonError, jsonOk } from "@/lib/http/api-response";
import { createSessionClient } from "@/lib/supabase/server-client";

export async function GET() {
  const supabase = await createSessionClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonError("Unauthorized", 401);
  }

  const [roles, teams] = await Promise.all([
    getUserRoles(supabase, user.id),
    loadTeamsForUser(supabase, user.id),
  ]);
  return jsonOk({
    user: { id: user.id, email: user.email },
    roles,
    teams,
  });
}
