import { createSessionClient } from "@/lib/supabase/server-client";
import { getUserRoles } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/http/api-response";

export async function GET() {
  const supabase = await createSessionClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonError("Unauthorized", 401);
  }

  const roles = await getUserRoles(supabase, user.id);
  return jsonOk({
    user: { id: user.id, email: user.email },
    roles,
  });
}
